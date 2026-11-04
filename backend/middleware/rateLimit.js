// Limitador de tentativas de login (proteção contra força bruta).
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.' } },
});

module.exports = { loginLimiter };
