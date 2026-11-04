const path = require('path');

module.exports = function (app) {
  // Configuración de cabeceras HTTP necesarias para Unity WebGL comprimido con Brotli
  app.use('/UniMapBuild/Build', (req, res, next) => {
    const file = req.path;

    if (file.endsWith('.data.unityweb')) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Encoding', 'br');
    } else if (file.endsWith('.wasm.unityweb')) {
      res.setHeader('Content-Type', 'application/wasm');
      res.setHeader('Content-Encoding', 'br');
    } else if (file.endsWith('.framework.js.unityweb')) {
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Content-Encoding', 'br');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });
};
