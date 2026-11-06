// Rotas de desperdício.
// - Consulta e registro: qualquer autenticado (a equipe registra a perda).
// - Estorno: apenas administrador/gerente.
const router = require('express').Router();
const controller = require('./desperdicio.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { sameOriginGuard } = require('../../middleware/requestGuard');
const { validateCreate } = require('./desperdicio.validator');

router.get('/', requireAuth, controller.list);
router.post('/', sameOriginGuard, requireAuth, validateCreate, controller.create);
router.post('/:id/estorno', sameOriginGuard, requireAuth, requireRole('admin', 'gerente'), controller.reverse);

module.exports = router;
