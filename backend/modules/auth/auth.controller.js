// Handlers HTTP da autenticação (coleção fina, sem regra de negócio).
const authService = require('./auth.service');
const { asyncHandler } = require('../../utils/errors');

const COOKIE_NAME = process.env.COOKIE_NAME || 'gg_token';

exports.login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body || {};
  const { token, payload, cookieName } = await authService.login({ identifier, password }, req.ip);

  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000, // 8 horas
    path: '/',
  });
  res.json({ user: payload });
});

exports.logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user, req.ip);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ message: 'Sessão encerrada.' });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});
