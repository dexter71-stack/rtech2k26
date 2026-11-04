// Rotas de autenticação.
const router = require('express').Router();
const controller = require('./auth.controller');
const { requireAuth } = require('../../middleware/auth');
const { loginLimiter } = require('../../middleware/rateLimit');
const { sameOriginGuard } = require('../../middleware/requestGuard');

router.post('/login', sameOriginGuard, loginLimiter, controller.login);
router.post('/logout', sameOriginGuard, requireAuth, controller.logout);
router.get('/me', requireAuth, controller.me);

module.exports = router;
