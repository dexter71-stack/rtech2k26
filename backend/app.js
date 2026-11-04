// Aplicação Express do Galeto Gestão (monólito modular).
// Frontend estático servido pela própria aplicação: mesma origem,
// sem necessidade de CORS.
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const { sameOriginGuard } = require('./middleware/requestGuard');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Cabeçalhos básicos de segurança.
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  // API REST.
  app.use('/api', sameOriginGuard, routes);

  // Frontend estático.
  const frontendDir = path.join(__dirname, '..', 'frontend');
  app.use(express.static(frontendDir));

  // Fallback para páginas do frontend (compatível com Express 5).
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.method !== 'GET') return next();
    return res.sendFile(path.join(frontendDir, 'index.html'));
  });

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
