// Centralizador das rotas de API por módulo.
const { Router } = require('express');
const { notFound } = require('../utils/errors');

const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../modules/users/user.routes');
const auditRoutes = require('../modules/audit/audit.routes');
const dashboardRoutes = require('../modules/dashboard/dashboard.routes');
const catalogoRoutes = require('../modules/catalogo/catalogo.routes');
const produtoRoutes = require('../modules/produtos/produto.routes');
const loteRoutes = require('../modules/lotes/lote.routes');
const movimentacaoRoutes = require('../modules/movimentacoes/movimentacao.routes');
const alertaRoutes = require('../modules/alertas/alerta.routes');

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/audit', auditRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/catalogo', catalogoRoutes);
router.use('/produtos', produtoRoutes);
router.use('/lotes', loteRoutes);
router.use('/movimentacoes', movimentacaoRoutes);
router.use('/alertas', alertaRoutes);

router.use(() => {
  throw notFound('Rota de API não encontrada.');
});

module.exports = router;
