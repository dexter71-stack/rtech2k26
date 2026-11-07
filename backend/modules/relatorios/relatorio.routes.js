// Rotas dos relatórios (leitura autenticada; compras restrita no controller).
const router = require('express').Router();
const controller = require('./relatorio.controller');
const { requireAuth } = require('../../middleware/auth');

router.get('/:tipo', requireAuth, controller.gerar);

module.exports = router;
