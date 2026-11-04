// Rotas de auditoria (somente administrador).
const router = require('express').Router();
const controller = require('./audit.controller');
const { requireAuth, requireRole } = require('../../middleware/auth');

router.get('/', requireAuth, requireRole('admin'), controller.list);

module.exports = router;
