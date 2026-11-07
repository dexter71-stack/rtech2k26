// Rotas de comunicação interna.
// - Mural e marcação de lido: qualquer autenticado.
// - Publicar, arquivar, reabrir e ver leituras: administrador/gerente.
const router = require('express').Router();
const controller = require('./comunicado.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { sameOriginGuard } = require('../../middleware/requestGuard');
const { validateCreate } = require('./comunicado.validator');

router.get('/', requireAuth, controller.list);
router.post('/', sameOriginGuard, requireAuth, requireRole('admin', 'gerente'), validateCreate, controller.create);
router.post('/:id/lido', sameOriginGuard, requireAuth, controller.markRead);
router.post('/:id/arquivar', sameOriginGuard, requireAuth, requireRole('admin', 'gerente'), controller.archive);
router.post('/:id/reabrir', sameOriginGuard, requireAuth, requireRole('admin', 'gerente'), controller.reopen);
router.get('/:id/leituras', requireAuth, requireRole('admin', 'gerente'), controller.reads);

module.exports = router;
