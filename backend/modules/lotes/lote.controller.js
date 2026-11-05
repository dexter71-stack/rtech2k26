// Handlers HTTP de lotes (validade / rastreabilidade por produto).
const loteRepository = require('./lote.repository');
const { asyncHandler } = require('../../utils/errors');

const STATUS = ['ativo', 'esgotado', 'vencido', 'cancelado'];

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(10, Number(req.query.pageSize) || 30));
  const productId = Number(req.query.product_id) || undefined;
  const status = STATUS.includes(req.query.status) ? req.query.status : undefined;
  const search = (req.query.search || '').trim().slice(0, 120) || undefined;
  const venceEmDias = Number(req.query.vence_em_dias);
  const apenasComSaldo = req.query.com_saldo === '1';

  await loteRepository.marcarVencidos();

  res.json(await loteRepository.list({
    productId,
    status,
    search,
    venceEmDias: Number.isFinite(venceEmDias) && venceEmDias > 0 ? venceEmDias : undefined,
    apenasComSaldo,
    page,
    pageSize,
  }));
});
