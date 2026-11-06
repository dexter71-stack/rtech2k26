// Handlers HTTP de fornecedores.
const service = require('./fornecedor.service');
const { asyncHandler, badRequest } = require('../../utils/errors');

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Identificador inválido.');
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
    search: (req.query.search || '').trim(),
    status: req.query.status || '',
    page,
    pageSize,
  });
  res.json(data);
});

exports.get = asyncHandler(async (req, res) => {
  res.json({ supplier: await service.get(parseId(req.params.id)) });
});

exports.create = asyncHandler(async (req, res) => {
  const created = await service.create(req.fornecedorData, { ...req.user, ip: req.ip });
  res.status(201).json({ supplier: created });
});

exports.update = asyncHandler(async (req, res) => {
  const updated = await service.update(parseId(req.params.id), req.fornecedorData, { ...req.user, ip: req.ip });
  res.json({ supplier: updated });
});

exports.remove = asyncHandler(async (req, res) => {
  await service.remove(parseId(req.params.id), { ...req.user, ip: req.ip });
  res.status(204).end();
});
