// Handlers HTTP do módulo de desperdício.
const service = require('./desperdicio.service');
const { asyncHandler, badRequest } = require('../../utils/errors');
const { MOTIVOS } = require('./desperdicio.validator');

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize) || 20));
  const productId = Number(req.query.product_id) || undefined;
  const reason = MOTIVOS.includes(req.query.reason) ? req.query.reason : undefined;
  const dateFrom = DATA_RE.test(req.query.dateFrom || '') ? req.query.dateFrom : undefined;
  const dateTo = DATA_RE.test(req.query.dateTo || '') ? req.query.dateTo : undefined;
  const status = ['registrado', 'estornado'].includes(req.query.status) ? req.query.status : undefined;
  const product = String(req.query.product || '').trim().slice(0, 100) || undefined;

  res.json(await service.list({ productId, product, reason, dateFrom, dateTo, status, page, pageSize }));
});

exports.create = asyncHandler(async (req, res) => {
  const record = await service.create(req.wasteData, { ...req.user, ip: req.ip });
  res.status(201).json({ waste: record });
});

exports.reverse = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Identificador inválido.');
  const waste = await service.reverse(id, { ...req.user, ip: req.ip });
  res.status(201).json({ waste });
});
