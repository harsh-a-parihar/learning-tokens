const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  // Proxy SDK API to port 5001
  app.use('/api', createProxyMiddleware({
    target: 'http://localhost:5001',
    changeOrigin: true,
    secure: false,
    logLevel: 'debug',
    onProxyReq: (proxyReq, req, res) => {
      // keep original cookie header so auth server can read session
      // header will be forwarded automatically by the proxy
    }
  }));

  // Proxy auth server to port 5002
  app.use('/auth', createProxyMiddleware({
    target: 'http://localhost:5002',
    changeOrigin: true,
    secure: false,
    logLevel: 'debug'
  }));
};
