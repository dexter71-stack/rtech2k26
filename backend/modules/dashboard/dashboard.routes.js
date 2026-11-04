// Rotas do dashboard (qual usuário autenticado pode consultar).
const router = require('express').Router();
const controller = require('./dashboard.controller');
const { requireAuth } = require('../../middleware/auth');

router.get('/summary', requireAuth, controller.summary);

module.exports = router;
