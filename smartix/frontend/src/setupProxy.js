const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use((req, res, next) => {
    if (req.path.endsWith('.png') || req.path.endsWith('.jpg') || req.path.endsWith('.svg')) {
      res.set('Cache-Control', 'public, max-age=2592000, immutable');
    }
    next();
  });

  const BACKEND_URL = 'http://127.0.0.1:8000';

  // NOTE: do NOT use app.use('/api', middleware) — Express strips the /api prefix.
  // Use createProxyMiddleware('/api', {...}) directly on app.use('/') so the
  // full path (including /api) is forwarded to the backend.
  app.use(
    createProxyMiddleware('/api', {
      target: BACKEND_URL,
      changeOrigin: true,
      logLevel: 'warn',
      onError: (err, req, res) => {
        console.error('[Proxy /api] Error:', err.message, 'for', req.url);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Backend unreachable', detail: err.message }));
      },
    })
  );

  app.use(
    createProxyMiddleware('/uploads', {
      target: BACKEND_URL,
      changeOrigin: true,
      logLevel: 'warn',
      onError: (err, req, res) => {
        console.error('[Proxy /uploads] Error:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Backend unreachable', detail: err.message }));
      },
    })
  );

  app.use(
    createProxyMiddleware('/ws', {
      target: BACKEND_URL,
      ws: true,
      changeOrigin: true,
      logLevel: 'warn',
    })
  );
};
