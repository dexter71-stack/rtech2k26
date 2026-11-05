// Rotas de movimentações.
// - Consulta: qualquer autenticado.
// - Registrar: qualquer autenticado (entradas exigem admin/gerente — validado no service).
// - Estorno: apenas admin/gerente.
const router = require('express').Router();
const controller = require('./movimentacao.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { sameOriginGuard } = require('../../middleware/requestGuard');
const { validateCreate } = require('./movimentacao.validator');

router.get('/', requireAuth, controller.list);
router.get('/produto/:productId/lotes', requireAuth, controller.lotesProduto);
router.post('/', sameOriginGuard, requireAuth, validateCreate, controller.create);
router.post('/:id/estorno', sameOriginGuard, requireAuth, requireRole('admin', 'gerente'), controller.reverse);

module.exports = router;
