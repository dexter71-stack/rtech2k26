// Utilitários de token de sessão (JWT em cookie HttpOnly).
const jwt = require('jsonwebtoken');

const secret = () => process.env.JWT_SECRET;
const expires = () => process.env.JWT_EXPIRES || '8h';

function signToken(payload) {
  if (!secret()) throw new Error('JWT_SECRET não configurado no .env');
  return jwt.sign(payload, secret(), { expiresIn: expires() });
}

function verifyToken(token) {
  return jwt.verify(token, secret());
}

module.exports = { signToken, verifyToken };
