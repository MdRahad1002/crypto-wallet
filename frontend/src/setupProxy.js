const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  const target = process.env.REACT_APP_API_TARGET || 'https://localhost:5000';

  // API proxy — HTTP only. Do NOT set ws:true here; that would intercept CRA's
  // own HMR websocket at /ws and proxy it to the backend, causing ECONNRESET.
  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      secure: false,
    })
  );

  // Socket.io proxy — WS enabled, scoped only to /socket.io so CRA HMR is unaffected.
  app.use(
    '/socket.io',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      secure: false,
      ws: true,
    })
  );
};
