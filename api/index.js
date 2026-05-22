// Vercel serverless entry point.
// Wrap in try/catch so module-load errors show in HTTP response instead of a blank 500.
let app;
let loadError = null;
try {
  app = require('../backend/server');
} catch (err) {
  loadError = err;
}

// Shared CORS helper — runs before Express so it always wins, even on a crash.
function applyCors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = (process.env.CORS_ORIGIN || 'https://www.bluewalletsecurity.com')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-CSRF-Token,X-API-Key,X-Request-Id,X-Request-Timestamp');
  res.setHeader('Vary', 'Origin');
}

// Main export: always set CORS first, then delegate to Express (or fallback on crash).
module.exports = (req, res) => {
  applyCors(req, res);
  // Handle preflight immediately — no need to involve Express.
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (loadError || !app) {
    res.setHeader('Content-Type', 'application/json');
    console.error('[api/index] module-load crash:', loadError?.message, loadError?.stack);
    res.status(500).end(JSON.stringify({
      crashed: true,
      phase: 'module-load',
      message: 'Internal server error. Check server logs for details.',
    }));
    return;
  }
  app(req, res);
};

// Catch top-level unhandled rejections that might crash the process on Vercel
process.on('unhandledRejection', (reason) => {
  console.error('[api/index] unhandledRejection:', reason);
  loadError = reason;
});
