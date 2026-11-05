// Handlers HTTP de produtos.
const produtoService = require('./produto.service');
const { asyncHandler, badRequest } = require('../../utils/errors');
const { STATUS } = require('./produto.validator');

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Identificador inválido.');
  return id;
}

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize) || 20));
  const search = (req.query.search || '').trim().slice(0, 120) || undefined;
  const categoryId = Number(req.query.category_id) || undefined;
  const status = STATUS.includes(req.query.status) ? req.query.status : undefined;
  const lowOnly = req.query.low_only === '1' || req.query.low_only === 'true';
  const includeInactive = req.user.role !== 'admin' && req.user.role !== 'gerente' ? 'ativo' : status;

  res.json(await produtoService.list({
    page, pageSize, search, categoryId, status: includeInactive, lowOnly,
  }));
});

exports.get = asyncHandler(async (req, res) => {
  res.json({ product: await produtoService.findById(parseId(req.params.id)) });
});

exports.create = asyncHandler(async (req, res) => {
  const created = await produtoService.create(req.productData, { ...req.user, ip: req.ip });
  res.status(201).json({ product: created });
});

exports.update = asyncHandler(async (req, res) => {
  const updated = await produtoService.update(parseId(req.params.id), req.productData, { ...req.user, ip: req.ip });
  res.json({ product: updated });
});
