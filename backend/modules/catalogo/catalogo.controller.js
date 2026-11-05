// Handlers HTTP do catálogo (categorias e unidades).
const catalogoService = require('./catalogo.service');
const { asyncHandler, badRequest } = require('../../utils/errors');

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Identificador inválido.');
  return id;
}

exports.listCategorias = asyncHandler(async (req, res) => {
  res.json({ rows: await catalogoService.listCategorias() });
});

exports.createCategoria = asyncHandler(async (req, res) => {
  const created = await catalogoService.createCategoria(req.catalogoData, { ...req.user, ip: req.ip });
  res.status(201).json({ category: created });
});

exports.updateCategoria = asyncHandler(async (req, res) => {
  const updated = await catalogoService.updateCategoria(parseId(req.params.id), req.catalogoData, { ...req.user, ip: req.ip });
  res.json({ category: updated });
});

exports.deleteCategoria = asyncHandler(async (req, res) => {
  await catalogoService.deleteCategoria(parseId(req.params.id), { ...req.user, ip: req.ip });
  res.status(204).end();
});

exports.listUnidades = asyncHandler(async (req, res) => {
  res.json({ rows: await catalogoService.listUnidades() });
});

exports.createUnidade = asyncHandler(async (req, res) => {
  const created = await catalogoService.createUnidade(req.catalogoData, { ...req.user, ip: req.ip });
  res.status(201).json({ unit: created });
});

exports.updateUnidade = asyncHandler(async (req, res) => {
  const updated = await catalogoService.updateUnidade(parseId(req.params.id), req.catalogoData, { ...req.user, ip: req.ip });
  res.json({ unit: updated });
});

exports.deleteUnidade = asyncHandler(async (req, res) => {
  await catalogoService.deleteUnidade(parseId(req.params.id), { ...req.user, ip: req.ip });
  res.status(204).end();
});
