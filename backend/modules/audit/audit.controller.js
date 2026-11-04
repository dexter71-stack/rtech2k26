// Handlers HTTP da auditoria.
const auditService = require('./audit.service');
const { asyncHandler, badRequest } = require('../../utils/errors');

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize) || 25));
  const { module, action, dateFrom, dateTo } = req.query;

  // Validação simples das datas em formato ISO.
  for (const d of [dateFrom, dateTo]) {
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw badRequest('Data inválida.');
  }

  const result = await auditService.list({ page, pageSize, moduleName: module, action, dateFrom, dateTo });
  res.json(result);
});
