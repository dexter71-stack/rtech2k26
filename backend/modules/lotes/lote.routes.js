// Rotas de lotes: consulta de rastreabilidade/validade (todos os perfis).
const router = require('express').Router();
const controller = require('./lote.controller');
const { requireAuth } = require('../../middleware/auth');

router.get('/', requireAuth, controller.list);

module.exports = router;
