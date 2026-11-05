// Lógica do catálogo: categorias e unidades de medida.
const catalogoRepository = require('./catalogo.repository');
const auditService = require('../audit/audit.service');
const { badRequest, notFound, conflict } = require('../../utils/errors');

async function listCategorias() {
  return catalogoRepository.listCategorias();
}

async function createCategoria(data, actor) {
  const dup = await catalogoRepository.findCategoriaByName(data.name);
  if (dup) throw conflict('Já existe uma categoria com este nome.');
  const created = await catalogoRepository.createCategoria(data);
  await auditService.log({
    userId: actor.id,
    action: 'CRIAR',
    module: 'Estoque',
    recordId: `cat:${created.id}`,
    description: `Categoria de ingrediente criada: ${created.name}`,
    ip: actor.ip,
  });
  return created;
}

async function updateCategoria(id, data, actor) {
  const target = await catalogoRepository.findCategoriaById(id);
  if (!target) throw notFound('Categoria não encontrada.');
  if (data.name !== undefined && data.name !== target.name) {
    const dup = await catalogoRepository.findCategoriaByName(data.name);
    if (dup && dup.id !== id) throw conflict('Já existe uma categoria com este nome.');
  }
  const updated = await catalogoRepository.updateCategoria(id, data);
  await auditService.log({
    userId: actor.id,
    action: 'ALTERAR',
    module: 'Estoque',
    recordId: `cat:${id}`,
    description: `Categoria atualizada: ${updated.name}`,
    ip: actor.ip,
  });
  return updated;
}

async function deleteCategoria(id, actor) {
  const target = await catalogoRepository.findCategoriaById(id);
  if (!target) throw notFound('Categoria não encontrada.');
  const categorias = await catalogoRepository.listCategorias();
  const inUse = categorias.find((c) => c.id === id && c.product_count > 0);
  if (inUse) throw badRequest('Não é possível excluir: existe produto cadastrado com esta categoria.');
  const affected = await catalogoRepository.deleteCategoria(id);
  if (!affected) throw notFound('Categoria não encontrada.');
  await auditService.log({
    userId: actor.id,
    action: 'EXCLUIR',
    module: 'Estoque',
    recordId: `cat:${id}`,
    description: `Categoria removida: ${target.name}`,
    ip: actor.ip,
  });
  return true;
}

async function listUnidades() {
  return catalogoRepository.listUnidades();
}

async function createUnidade(data, actor) {
  const dupSymbol = await catalogoRepository.findUnidadeBySymbol(data.symbol);
  if (dupSymbol) throw conflict('Já existe uma unidade com este símbolo.');
  const dupName = await catalogoRepository.findUnidadeByName(data.name);
  if (dupName) throw conflict('Já existe uma unidade com este nome.');
  const created = await catalogoRepository.createUnidade(data);
  await auditService.log({
    userId: actor.id,
    action: 'CRIAR',
    module: 'Estoque',
    recordId: `un:${created.id}`,
    description: `Unidade de medida criada: ${created.name} (${created.symbol})`,
    ip: actor.ip,
  });
  return created;
}

async function updateUnidade(id, data, actor) {
  const target = await catalogoRepository.findUnidadeById(id);
  if (!target) throw notFound('Unidade não encontrada.');
  if (data.symbol !== undefined && data.symbol !== target.symbol) {
    const dup = await catalogoRepository.findUnidadeBySymbol(data.symbol);
    if (dup && dup.id !== id) throw conflict('Já existe uma unidade com este símbolo.');
  }
  if (data.name !== undefined && data.name !== target.name) {
    const dup = await catalogoRepository.findUnidadeByName(data.name);
    if (dup && dup.id !== id) throw conflict('Já existe uma unidade com este nome.');
  }
  const updated = await catalogoRepository.updateUnidade(id, data);
  await auditService.log({
    userId: actor.id,
    action: 'ALTERAR',
    module: 'Estoque',
    recordId: `un:${id}`,
    description: `Unidade atualizada: ${updated.name} (${updated.symbol})`,
    ip: actor.ip,
  });
  return updated;
}

async function deleteUnidade(id, actor) {
  const target = await catalogoRepository.findUnidadeById(id);
  if (!target) throw notFound('Unidade não encontrada.');
  const unidades = await catalogoRepository.listUnidades();
  const inUse = unidades.find((u) => u.id === id && u.product_count > 0);
  if (inUse) throw badRequest('Não é possível excluir: existe produto cadastrado com esta unidade.');
  const affected = await catalogoRepository.deleteUnidade(id);
  if (!affected) throw notFound('Unidade não encontrada.');
  await auditService.log({
    userId: actor.id,
    action: 'EXCLUIR',
    module: 'Estoque',
    recordId: `un:${id}`,
    description: `Unidade removida: ${target.name}`,
    ip: actor.ip,
  });
  return true;
}

module.exports = {
  listCategorias, createCategoria, updateCategoria, deleteCategoria,
  listUnidades, createUnidade, updateUnidade, deleteUnidade,
};
