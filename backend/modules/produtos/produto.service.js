// Regras de negócio de produtos.
const produtoRepository = require('./produto.repository');
const catalogoRepository = require('../catalogo/catalogo.repository');
const auditService = require('../audit/audit.service');
const { badRequest, notFound, conflict } = require('../../utils/errors');

async function assertReferenciasValidas(data, exceptProductId) {
  const problemas = [];
  if (data.category_id != null) {
    const cat = await catalogoRepository.findCategoriaById(data.category_id);
    if (!cat) problemas.push('Categoria informada não existe.');
  }
  if (data.unit_id != null) {
    const un = await catalogoRepository.findUnidadeById(data.unit_id);
    if (!un) problemas.push('Unidade de medida informada não existe.');
  }
  if (problemas.length) throw badRequest('Corrija os campos do formulário.', problemas);
}

async function list(filters) {
  return produtoRepository.list(filters);
}

async function findById(id) {
  const produto = await produtoRepository.findById(id);
  if (!produto) throw notFound('Produto não encontrado.');
  return produto;
}

async function create(data, actor) {
  await assertReferenciasValidas(data);

  const dup = await produtoRepository.list({ search: data.name, page: 1, pageSize: 50 });
  const existente = dup.rows.find((r) => r.name.toLowerCase() === data.name.toLowerCase());
  if (existente) throw conflict(`Já existe um produto cadastrado com o nome “${existente.name}”.`);

  const created = await produtoRepository.create(data);
  await auditService.log({
    userId: actor.id,
    action: 'CRIAR',
    module: 'Estoque',
    recordId: `prod:${created.id}`,
    description: `Produto cadastrado: ${created.name}`,
    ip: actor.ip,
  });
  return created;
}

async function update(id, data, actor) {
  const target = await produtoRepository.findById(id);
  if (!target) throw notFound('Produto não encontrado.');
  await assertReferenciasValidas(data, id);

  if (data.name !== undefined && data.name.toLowerCase() !== target.name.toLowerCase()) {
    const dup = await produtoRepository.list({ search: data.name, page: 1, pageSize: 50 });
    const existente = dup.rows.find((r) => r.id !== id && r.name.toLowerCase() === data.name.toLowerCase());
    if (existente) throw conflict(`Já existe outro produto com o nome “${data.name}”.`);
  }

  const updated = await produtoRepository.update(id, data);
  await auditService.log({
    userId: actor.id,
    action: 'ALTERAR',
    module: 'Estoque',
    recordId: `prod:${id}`,
    description: `Produto atualizado: ${updated.name}`,
    ip: actor.ip,
  });
  return updated;
}

module.exports = { list, findById, create, update };
