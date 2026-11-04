// Handlers HTTP de funcionários.
const userService = require('./user.service');
const auditService = require('../audit/audit.service');
const { asyncHandler, badRequest } = require('../../utils/errors');

const ROLES = ['admin', 'gerente', 'funcionario'];
const STATUS = ['ativo', 'inativo'];

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize) || 20));
  const search = (req.query.search || '').trim().slice(0, 120) || undefined;
  const role = ROLES.includes(req.query.role) ? req.query.role : undefined;
  const status = STATUS.includes(req.query.status) ? req.query.status : undefined;

  res.json(await userService.list({ page, pageSize, search, role, status }));
});

exports.create = asyncHandler(async (req, res) => {
  const created = await userService.create(req.userData, { ...req.user, ip: req.ip });
  res.status(201).json({ user: created });
});

exports.update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Identificador inválido.');
  const updated = await userService.update(id, req.userData, { ...req.user, ip: req.ip });
  res.json({ user: updated });
});

exports.activate = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Identificador inválido.');
  const updated = await userService.setStatus(id, 'ativo', { ...req.user, ip: req.ip });
  res.json({ user: updated });
});

exports.deactivate = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Identificador inválido.');
  const updated = await userService.setStatus(id, 'inativo', { ...req.user, ip: req.ip });
  res.json({ user: updated });
});

exports.myAuditRefs = asyncHandler(async (req, res) => {
  res.json(await auditService.list({ page: 1, pageSize: 10 }));
});
