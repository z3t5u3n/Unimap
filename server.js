/**
 * Servidor Node.js Express para Despliegue en Render (Modo Web Service)
 * Optimizado específicamente para entrega de Unity WebGL con compresión Gzip nativa y SPA.
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BUILD_PATH = path.join(__dirname, 'build');

// 1. Manejador específico de cabeceras para archivos compilados de Unity WebGL (.unityweb)
app.use('/UniMapBuild/Build', (req, res, next) => {
  const file = req.path;

  // Asignar cabecera de compresión y tipo MIME correcto según extensión
  if (file.endsWith('.data.unityweb')) {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (file.endsWith('.wasm.unityweb')) {
    res.setHeader('Content-Type', 'application/wasm');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (file.endsWith('.framework.js.unityweb')) {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (file.endsWith('.loader.js')) {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  // Permitir peticiones cross-origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// 2. Servir la carpeta de build con soporte de caché
app.use(express.static(BUILD_PATH, {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    // Para bundles estáticos de React con hash (inmutables)
    if (filePath.includes('/static/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    // Para index.html (siempre validar)
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  }
}));

// 3. Fallback SPA para React Router (cualquier ruta devuelve index.html)
app.get('*', (req, res) => {
  res.sendFile(path.join(BUILD_PATH, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`UniMap Frontend escuchando en puerto ${PORT}`);
  console.log(`Ruta de archivos estáticos: ${BUILD_PATH}`);
});
