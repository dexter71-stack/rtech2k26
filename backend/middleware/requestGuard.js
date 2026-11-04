// Proteção CSRF básica: o cookie de sessão usa SameSite=Lax e, além disso,
// métodos que alteram dados só aceitam requisições da própria origem.
const { badRequest } = require('../utils/errors');

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function sameOriginGuard(req, res, next) {
  if (!MUTATING.has(req.method)) return next();

  const origin = req.headers.origin || req.headers.referer;
  if (!origin) return next(); // clientes que não enviam Origin (curl, etc.)

  try {
    const url = new URL(origin);
    const host = req.headers.host;
    if (url.host !== host) throw badRequest('Requisição rejeitada: origem não confiável.');
  } catch (err) {
    if (err && err.status === 400) return next(err);
    return next(badRequest('Requisição rejeitada: origem inválida.'));
  }
  next();
}

module.exports = { sameOriginGuard };
