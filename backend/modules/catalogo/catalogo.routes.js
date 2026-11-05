// Rotas do catálogo: leitura para qualquer autenticado, escrita admin/gerente.
const router = require('express').Router();
const controller = require('./catalogo.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { sameOriginGuard } = require('../../middleware/requestGuard');
const { validateCategoria, validateUnidade } = require('./catalogo.validator');

const podeGerenciar = requireRole('admin', 'gerente');

router.get('/categorias', requireAuth, controller.listCategorias);
router.post('/categorias', sameOriginGuard, requireAuth, podeGerenciar, validateCategoria, controller.createCategoria);
router.put('/categorias/:id', sameOriginGuard, requireAuth, podeGerenciar, validateCategoria, controller.updateCategoria);
router.delete('/categorias/:id', sameOriginGuard, requireAuth, podeGerenciar, controller.deleteCategoria);

router.get('/unidades', requireAuth, controller.listUnidades);
router.post('/unidades', sameOriginGuard, requireAuth, podeGerenciar, validateUnidade, controller.createUnidade);
router.put('/unidades/:id', sameOriginGuard, requireAuth, podeGerenciar, validateUnidade, controller.updateUnidade);
router.delete('/unidades/:id', sameOriginGuard, requireAuth, podeGerenciar, controller.deleteUnidade);

module.exports = router;
