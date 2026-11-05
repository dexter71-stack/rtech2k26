// Rotas de produtos: consulta liberada para os três perfis; escrita só admin/gerente.
const router = require('express').Router();
const controller = require('./produto.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { sameOriginGuard } = require('../../middleware/requestGuard');
const { validateCreate, validateUpdate } = require('./produto.validator');

router.use(requireAuth);

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', sameOriginGuard, requireRole('admin', 'gerente'), validateCreate, controller.create);
router.put('/:id', sameOriginGuard, requireRole('admin', 'gerente'), validateUpdate, controller.update);

module.exports = router;
