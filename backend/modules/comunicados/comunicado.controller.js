// Handlers HTTP do módulo de comunicação.
const service = require('./comunicado.service');
const { asyncHandler, badRequest } = require('../../utils/errors');
const { PRIORIDADES } = require('./comunicado.validator');

const podeGerenciar = (user) => user.role === 'admin' || user.role === 'gerente';

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize) || 50));
  const priority = PRIORIDADES.includes(req.query.priority) ? req.query.priority : undefined;
  const search = String(req.query.search || '').trim().slice(0, 80) || undefined;
  // Funcionário só vê o mural ativo; administrador/gerente também o histórico.
  let status = ['ativo', 'arquivado'].includes(req.query.status) ? req.query.status : 'ativo';
  if (!podeGerenciar(req.user)) status = 'ativo';

  res.json(await service.list({ status, priority, search, page, pageSize, userId: req.user.id }));
});

exports.create = asyncHandler(async (req, res) => {
  const comunicado = await service.create(req.comunicadoData, { ...req.user, ip: req.ip });
  res.status(201).json({ comunicado });
});

exports.markRead = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Identificador inválido.');
  const comunicado = await service.marcarLido(id, { ...req.user, ip: req.ip });
  res.json({ comunicado });
});

exports.archive = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Identificador inválido.');
  const comunicado = await service.alterarStatus(id, 'arquivado', { ...req.user, ip: req.ip });
  res.json({ comunicado });
});

exports.reopen = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Identificador inválido.');
  const comunicado = await service.alterarStatus(id, 'ativo', { ...req.user, ip: req.ip });
  res.json({ comunicado });
});

exports.reads = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Identificador inválido.');
  res.json(await service.leituras(id, { ...req.user, ip: req.ip }));
});
