// Rotas de fornecedores: leitura para os três perfis; escrita só admin/gerente.
const router = require('express').Router();
const controller = require('./fornecedor.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { sameOriginGuard } = require('../../middleware/requestGuard');
const { validateCreate, validateUpdate } = require('./fornecedor.validator');

router.use(requireAuth);

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', sameOriginGuard, requireRole('admin', 'gerente'), validateCreate, controller.create);
router.put('/:id', sameOriginGuard, requireRole('admin', 'gerente'), validateUpdate, controller.update);
router.delete('/:id', sameOriginGuard, requireRole('admin', 'gerente'), controller.remove);

module.exports = router;
