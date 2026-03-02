// Server restart trigger
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { createLimiter } = require('./middleware/rateLimiter');
const { antiReplay } = require('./middleware/antiReplay');
const errorHandler = require('./core/errorHandler');
const helmet = require('helmet');
const logger = require('./core/logger');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { getLiveUsdPrices } = require('./services/pricesService');
const metricsService = require('./services/metricsService');
const { sessionMiddleware, autoRefreshCookieTTL, validateCookieSameSite } = require('./middleware/cookieSession');
const { doubleCsrf } = require('csrf-csrf');
const kmsService = require('./services/kmsService');
const secretsManager = require('./services/secretsManager');
const configLoader = require('./core/configLoader');
const crypto = require('crypto');

dotenv.config();

// Vercel sets VERCEL=1 automatically. When true, skip local HTTPS/Socket.io/server.listen.
const isVercel = !!process.env.VERCEL;

if (process.env.NODE_ENV !== 'production') {
  if (!process.env.COOKIE_SECRET) {
    // Generate a random secret for development - not hardcoded
    process.env.COOKIE_SECRET = crypto.randomBytes(32).toString('hex');
  }

  if (!process.env.JWT_SECRET) {
    // Generate a random secret for development - not hardcoded
    process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  }

}

const app = express();

// Security Middleware
// CSP is managed by vercel.json headers for all routes.
// Helmet's contentSecurityPolicy is disabled here to avoid conflicting CSP headers
// on API responses (which the browser could misinterpret as the page-level policy).
app.use(helmet({
  contentSecurityPolicy: false,
}));
// Support comma-separated CORS_ORIGIN for multiple allowed origins (e.g. Vercel preview + production URLs)
const _corsAllowed = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, same-origin)
    if (!origin || _corsAllowed.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'X-API-Key',
    'X-Request-Id',
    'X-Request-Timestamp'
  ]
}));
app.use(express.json({ limit: '10mb' }));
let cookieSecret = process.env.COOKIE_SECRET;
if (!cookieSecret) {
  // Generate a per-process secret rather than crashing the serverless function.
  // Sessions won't survive across cold-starts, but the service stays up.
  cookieSecret = crypto.randomBytes(32).toString('hex');
  logger.warn('COOKIE_SECRET not set — generated ephemeral secret. Set COOKIE_SECRET in Vercel env vars.');
}
app.use(cookieParser(cookieSecret));

app.set('trust proxy', 1);

if (process.env.REQUIRE_HTTPS === 'true') {
  app.use((req, res, next) => {
    const isSecure = req.secure || req.get('x-forwarded-proto') === 'https';
    if (!isSecure) {
      return res.status(403).json({ message: 'HTTPS is required' });
    }
    return next();
  });
}

// Metrics tracking middleware - record all HTTP requests
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.info('http_request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: durationMs,
      ip: req.ip
    });
    // Record metrics
    metricsService.recordRequest(req.method, req.path, res.statusCode, durationMs);
  });
  next();
});

// Session and Cookie Management Middleware
app.use(sessionMiddleware);
app.use(validateCookieSameSite);
app.use(autoRefreshCookieTTL);

// CSRF Protection via csrf-csrf (Double Submit Cookie pattern)
// Auth endpoints are excluded as they bootstrap session state.
// Bearer-token-authenticated routes are also excluded — CSRF attacks cannot
// forge custom Authorization headers, making CSRF protection redundant there.
const CSRF_SKIP_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/csrf-token',
  '/api/admin',
  '/api/wallet',
  '/api/transactions',
  '/api/tokens',
  '/api/prices',
  '/api/health',
  '/api/debug',
  '/api/metrics',
  '/api/support',  // JWT Bearer-auth route — CSRF not needed
];
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.COOKIE_SECRET,
  cookieName: 'csrfToken',           // matches getCookieValue('csrfToken') in client.js
  cookieOptions: {
    // Cross-domain (Vercel frontend → separate backend host) requires sameSite:'none' + secure:true.
    // In development keep 'strict' to avoid HTTPS requirement on localhost.
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,                 // must be false so JS can read and send in header
    path: '/',
  },
  size: 64,
  // Tie CSRF to the refresh-token cookie (stable per session); fall back to IP for pre-login requests
  getSessionIdentifier: (req) => {
    const rt = req.cookies?.refreshToken;
    if (rt) return crypto.createHash('sha256').update(rt).digest('hex').substring(0, 16);
    return crypto.createHash('sha256').update((req.ip || '') + (req.headers['user-agent'] || '')).digest('hex').substring(0, 16);
  },
  getTokenFromRequest: (req) =>
    req.headers['x-csrf-token'] || req.headers['x-csrf-token'.toLowerCase()] || req.body?.csrfToken,
});
app.locals.generateCsrfToken = generateCsrfToken;
app.use((req, res, next) => {
  if (CSRF_SKIP_PATHS.some((p) => req.path.startsWith(p))) return next();
  return doubleCsrfProtection(req, res, next);
});

// Rate limiting
const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Too many requests, please try again later.'
});
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: 'Too many authentication attempts, please try again later.'
});
const walletLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 200,
  message: 'Too many wallet requests, please try again later.'
});
const txLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many transaction requests, please try again later.'
});
const adminLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 200,
  message: 'Too many admin requests, please try again later.'
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter, antiReplay({ requireHeaders: false }));
app.use('/api/wallet/', walletLimiter, antiReplay({ requireHeaders: false }));
app.use('/api/transactions/', txLimiter, antiReplay({ requireHeaders: false }));
app.use('/api/tokens/', txLimiter, antiReplay({ requireHeaders: false }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/prices', require('./routes/prices'));
app.use('/api/tokens', require('./routes/tokens'));
app.use('/api/support', require('./routes/support'));

// Admin routes - multi-layer security
const { adminAccessControl } = require('./middleware/adminAccessControl');
app.use('/api/admin', adminLimiter, antiReplay({ requireHeaders: false }), ...adminAccessControl(), require('./routes/admin'));

// Initialize KMS, Secrets and Supabase
let jwtSecret = null;

(async () => {
  try {
    await kmsService.initialize();
    logger.info('kms_initialized', { type: 'infrastructure' });

    await secretsManager.initialize();
    logger.info('secrets_manager_initialized', { type: 'infrastructure' });

    await configLoader.load(secretsManager);
    logger.info('configuration_loaded', { type: 'infrastructure' });

    // Ensure WALLET_MASTER_KEY is available (loads from DB or auto-generates)
    const masterKeyService = require('./services/masterKeyService');
    await masterKeyService.initialize();

    // Ensure ENCRYPTION_MASTER_KEY is available (used for user wallet private-key encryption)
    const encryptionKeyService = require('./services/encryptionKeyService');
    await encryptionKeyService.initialize();

    jwtSecret = configLoader.get('JWT_SECRET');
    if (!jwtSecret) throw new Error('JWT_SECRET not configured');

    // Supabase Storage — ensure kyc-documents bucket exists (idempotent)
    const { ensureKycBucket } = require('./services/supabaseClient');
    ensureKycBucket().catch((err) =>
      logger.warn('supabase_bucket_init_error', { message: err.message })
    );
    logger.info('supabase_ready', { type: 'infrastructure', status: 'success' });
    metricsService.updateSystemMetrics(true);
  } catch (error) {
    logger.error('initialization_failed', {
      type: 'infrastructure',
      message: error.message,
      errorType: 'startup_error'
    });
    metricsService.updateSystemMetrics(false);
    if (!isVercel) process.exit(1);
  }
})();

// Health check endpoint
app.get('/api/health', (req, res) => {
  metricsService.updateSystemMetrics(true);
  res.json({
    status: 'OK',
    message: 'Crypto Wallet API is running',
    database: 'supabase',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - metricsService.startTime) / 1000)
  });
});

// Debug endpoint — tests Supabase connection and env var presence
app.get('/api/debug', async (req, res) => {
  const hasUrl = !!process.env.SUPABASE_URL;
  const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasCookie = !!process.env.COOKIE_SECRET;
  const hasJwt = !!process.env.JWT_SECRET;
  let dbOk = false;
  let dbError = null;
  try {
    const { getSupabaseAdmin } = require('./services/supabaseClient');
    const db = getSupabaseAdmin();
    if (db) {
      const { data, error } = await db.from('users').select('id').limit(1);
      dbOk = !error;
      dbError = error ? error.message : null;
    } else {
      dbError = 'getSupabaseAdmin() returned null';
    }
  } catch (e) {
    dbError = e.message;
  }
  res.json({ hasUrl, hasKey, hasCookie, hasJwt, dbOk, dbError });
});

// Prometheus metrics endpoint
app.get('/api/metrics', (req, res) => {
  metricsService.updateSystemMetrics(true);
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(metricsService.getPrometheusMetrics());
});

// JSON metrics summary endpoint (for debugging/dashboards)
app.get('/api/metrics/summary', (req, res) => {
  metricsService.updateSystemMetrics(true);
  res.json(metricsService.getMetricsSummary());
});

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

app.use(errorHandler);

if (process.env.JOBS_ENABLED === 'true') {
  const { startTxWatcher } = require('./jobs/txWatcher');
  const { startBalanceRefresher } = require('./jobs/balanceRefresher');
  const { startWebhookDispatcher } = require('./jobs/webhookDispatcher');
  startTxWatcher();
  startBalanceRefresher();
  startWebhookDispatcher();
}

const tlsKeyPath = process.env.TLS_KEY_PATH;
const tlsCertPath = process.env.TLS_CERT_PATH;

// Bundled self-signed dev certs (certs/ directory) used when no TLS_KEY_PATH/TLS_CERT_PATH provided
const DEV_CERT_DIR = path.join(__dirname, 'certs');
const devCertPath = path.join(DEV_CERT_DIR, 'localhost.cert.pem');
const devKeyPath  = path.join(DEV_CERT_DIR, 'localhost.key.pem');

function loadTlsCredentials(keyPath, certPath) {
  return {
    key:  fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
}

// On Vercel, TLS and listening are handled by the platform — skip local HTTPS server.

let server;

if (!isVercel) {
// Always use HTTPS. Production deployments should set TLS_KEY_PATH / TLS_CERT_PATH.
// Development falls back to the bundled self-signed certs in backend/certs/.
// If you are behind a reverse proxy that terminates TLS, set TLS_KEY_PATH/TLS_CERT_PATH
// pointing to your proxy's internal cert, or use the bundled dev certs (proxy trusts all).
const keyFile  = tlsKeyPath  || devKeyPath;
const certFile = tlsCertPath || devCertPath;

if (process.env.NODE_ENV === 'production' && !tlsKeyPath && !tlsCertPath) {
  console.warn('⚠️  WARNING: Production is using bundled self-signed TLS certificates.');
  console.warn('    Set TLS_KEY_PATH and TLS_CERT_PATH to use production certificates.');
}

try {
  server = https.createServer(loadTlsCredentials(keyFile, certFile), app);
  if (tlsKeyPath && process.env.NODE_ENV !== 'test') {
    console.log('🔒 Using HTTPS with TLS certificates');
  } else if (process.env.NODE_ENV !== 'test') {
    console.log('🔒 Using HTTPS with bundled dev certificates');
  }
} catch (error) {
  // Cert load failure is fatal — regenerate certs in backend/certs/ for development
  // or set TLS_KEY_PATH / TLS_CERT_PATH for production.
  throw new Error(`TLS certificate load failed: ${error.message}`);
}
}

if (!isVercel) {
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  },
  // Auth is required - clients must provide token in handshake
  auth: {
    required: true
  }
});

// Setup WebSocket security (authentication + rate limiting)
const { setupWebSocketSecurity } = require('./middleware/websocketSecurity');
setupWebSocketSecurity(io, {
  maxEventsPerSecond: parseInt(process.env.SOCKET_MAX_EVENTS_PER_SECOND || '10', 10),
  maxEventsPerMinute: parseInt(process.env.SOCKET_MAX_EVENTS_PER_MINUTE || '300', 10),
  enableMetrics: true
});

// Handle authenticated connections
io.on('connection', (socket) => {
  // Emit successful connection message
  socket.emit('prices:connected', {
    type: 'authenticated',
    ts: Date.now(),
    socketId: socket.id,
    userId: socket.userId
  });

  // Send initial prices
  const sendPrices = async () => {
    try {
      const prices = await getLiveUsdPrices();
      socket.emit('prices:usd', { ts: Date.now(), prices });
    } catch (error) {
      logger.warn('price_fetch_error', {
        socketId: socket.id,
        message: error.message
      });
      socket.emit('prices:error', { ts: Date.now(), message: 'price fetch failed' });
    }
  };

  // Send initial prices immediately
  sendPrices();

  // Then send every 5 seconds
  const priceTimer = setInterval(sendPrices, 5000);

  // Handle client price update requests (with rate limiting)
  socket.on('prices:request', async (data) => {
    logger.info('websocket_event', {
      type: 'websocket_event',
      event: 'prices_request',
      socketId: socket.id,
      userId: socket.userId
    });
    await sendPrices();
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    clearInterval(priceTimer);
    logger.info('websocket_disconnected', {
      socketId: socket.id,
      userId: socket.userId
    });
  });
});

// Handle auth errors
io.on('connect_error', (error) => {
  logger.error('websocket_connection_error', {
    message: error.message,
    errorType: 'websocket_connection_error'
  });
  metricsService.recordError('websocket_connection_error');
});

// Prevent unhandled TLS/socket errors from crashing the process.
// ECONNRESET is common when a client (e.g. CRA HMR WS) abruptly drops a TLS connection.
server.on('tlsClientError', (err, tlsSocket) => {
  logger.warn('tls_client_error', { code: err.code, message: err.message });
  tlsSocket.destroy();
});

server.on('error', (err) => {
  logger.error('https_server_error', { code: err.code, message: err.message });
});

server.listen(PORT, HOST, () => {
  const protocol = 'https'; // always HTTPS — http.createServer is no longer used
  console.log(`Server running on port ${PORT}`);
  console.log(`Access from this computer: ${protocol}://localhost:${PORT}`);
  console.log(`Access from network: ${protocol}://<your-ip>:${PORT}`);
});
} // end !isVercel

// Export app for Vercel serverless
module.exports = app;
