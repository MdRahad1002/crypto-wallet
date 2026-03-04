// Vercel serverless entry point.
// Wrap in try/catch so module-load errors show in HTTP response instead of a blank 500.
let app;
let loadError = null;
try {
  app = require('../backend/server');
} catch (err) {
  loadError = err;
  app = (req, res) => {
    // Always set CORS headers so browser does not mask the real error as a CORS failure
    const origin = req.headers.origin || '';
    const allowed = (process.env.CORS_ORIGIN || 'https://www.bluewalletsecurity.com').split(',').map(s => s.trim());
    if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-CSRF-Token,X-API-Key,X-Request-Id,X-Request-Timestamp');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    res.setHeader('Content-Type', 'application/json');
    // Log full details server-side but never expose stack traces to clients
    console.error('[api/index] module-load crash:', loadError?.message, loadError?.stack);
    res.status(500).end(JSON.stringify({
      crashed: true,
      phase: 'module-load',
      message: 'Internal server error. Check server logs for details.',
    }));
  };
}

// Catch top-level unhandled rejections that might crash the process on Vercel
process.on('unhandledRejection', (reason) => {
  console.error('[api/index] unhandledRejection:', reason);
  loadError = reason;
});

module.exports = app;
