// Rotas de configurações.
// - Leitura: qualquer autenticado (nome do estabelecimento aparece no layout).
// - Alteração: somente administrador.
const router = require('express').Router();
const controller = require('./configuracao.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { sameOriginGuard } = require('../../middleware/requestGuard');
const { validateUpdate } = require('./configuracao.validator');

router.get('/', requireAuth, controller.obter);
router.put('/', sameOriginGuard, requireAuth, requireRole('admin'), validateUpdate, controller.atualizar);

module.exports = router;
