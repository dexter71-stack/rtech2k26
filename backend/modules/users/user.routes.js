// Rotas de funcionários (somente administrador, validado no backend).
const router = require('express').Router();
const controller = require('./user.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { sameOriginGuard } = require('../../middleware/requestGuard');
const { validateCreate, validateUpdate } = require('./user.validator');

router.use(requireAuth, requireRole('admin'));

router.get('/', controller.list);
router.post('/', sameOriginGuard, validateCreate, controller.create);
router.put('/:id', sameOriginGuard, validateUpdate, controller.update);
router.post('/:id/activate', sameOriginGuard, controller.activate);
router.post('/:id/deactivate', sameOriginGuard, controller.deactivate);

module.exports = router;
