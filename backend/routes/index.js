// Centralizador das rotas de API por módulo.
const { Router } = require('express');
const { notFound } = require('../utils/errors');

const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../modules/users/user.routes');
const auditRoutes = require('../modules/audit/audit.routes');
const dashboardRoutes = require('../modules/dashboard/dashboard.routes');

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/audit', auditRoutes);
router.use('/dashboard', dashboardRoutes);

router.use(() => {
  throw notFound('Rota de API não encontrada.');
});

module.exports = router;
