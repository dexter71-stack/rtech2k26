// Handlers HTTP de compras.
const service = require('./compra.service');
const { asyncHandler, badRequest } = require('../../utils/errors');
const { parseId, dataValida } = require('./compra.validator');

function idParam(raw) {
  const id = parseId(raw);
  if (!id) throw badRequest('Identificador inválido.');
  return id;
}

function parsePage(q) {
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20));
  return { page, pageSize };
}

exports.list = asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePage(req.query);
  const data = await service.list({
    supplierId: parseId(req.query.supplier_id) || null,
    status: req.query.status || '',
    dateFrom: dataValida(req.query.dateFrom) ? req.query.dateFrom : null,
    dateTo: dataValida(req.query.dateTo) ? req.query.dateTo : null,
    search: (req.query.search || '').trim(),
    page,
    pageSize,
  });
  res.json(data);
});

exports.get = asyncHandler(async (req, res) => {
  res.json({ purchase: await service.get(idParam(req.params.id)) });
});

exports.create = asyncHandler(async (req, res) => {
  const created = await service.create(req.compraData, { ...req.user, ip: req.ip });
  res.status(201).json({ purchase: created });
});

exports.update = asyncHandler(async (req, res) => {
  const updated = await service.update(idParam(req.params.id), req.compraData, { ...req.user, ip: req.ip });
  res.json({ purchase: updated });
});

exports.receive = asyncHandler(async (req, res) => {
  const updated = await service.receive(idParam(req.params.id), req.recebimentoData, { ...req.user, ip: req.ip });
  res.json({ purchase: updated });
});

exports.cancel = asyncHandler(async (req, res) => {
  const updated = await service.cancel(idParam(req.params.id), { ...req.user, ip: req.ip });
  res.json({ purchase: updated });
});

exports.reverse = asyncHandler(async (req, res) => {
  const updated = await service.reverse(idParam(req.params.id), { ...req.user, ip: req.ip });
  res.json({ purchase: updated });
});
