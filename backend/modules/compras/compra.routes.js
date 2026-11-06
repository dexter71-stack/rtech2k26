// Rotas de compras: módulo restrito a administrador e gerente.
const router = require('express').Router();
const controller = require('./compra.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { sameOriginGuard } = require('../../middleware/requestGuard');
const { validateCreate, validateUpdate, validateReceive } = require('./compra.validator');

router.use(requireAuth);
router.use(requireRole('admin', 'gerente'));

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', sameOriginGuard, validateCreate, controller.create);
router.put('/:id', sameOriginGuard, validateUpdate, controller.update);
router.post('/:id/receber', sameOriginGuard, validateReceive, controller.receive);
router.post('/:id/cancelar', sameOriginGuard, controller.cancel);
router.post('/:id/estornar', sameOriginGuard, controller.reverse);

module.exports = router;
