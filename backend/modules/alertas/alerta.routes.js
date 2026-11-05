// Rotas de alertas do estoque (qualquer autenticado consulta; gera no servidor).
const router = require('express').Router();
const controller = require('./alerta.controller');
const { requireAuth } = require('../../middleware/auth');

router.get('/', requireAuth, controller.alertas);

module.exports = router;
