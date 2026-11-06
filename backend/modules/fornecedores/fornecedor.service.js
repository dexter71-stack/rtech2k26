// Lógica de fornecedores: unicidade de documento, integridade e auditoria.
const fornecedorRepository = require('./fornecedor.repository');
const auditService = require('../audit/audit.service');
const { badRequest, notFound, conflict } = require('../../utils/errors');

async function list(filters) {
  return fornecedorRepository.list(filters);
}

async function get(id) {
  const fornecedor = await fornecedorRepository.findById(id);
  if (!fornecedor) throw notFound('Fornecedor não encontrado.');
  return fornecedor;
}

async function create(data, actor) {
  if (data.document) {
    const dup = await fornecedorRepository.findByDocument(data.document);
    if (dup) throw conflict('Já existe um fornecedor com este CNPJ/CPF.');
  }
  const created = await fornecedorRepository.create(data);
  await auditService.log({
    userId: actor.id,
    action: 'CRIAR',
    module: 'Fornecedores',
    recordId: `forn:${created.id}`,
    description: `Fornecedor cadastrado: ${created.name}`,
    ip: actor.ip,
  });
  return created;
}

async function update(id, data, actor) {
  const target = await fornecedorRepository.findById(id);
  if (!target) throw notFound('Fornecedor não encontrado.');

  if (data.document !== undefined && data.document && data.document !== target.document) {
    const dup = await fornecedorRepository.findByDocument(data.document);
    if (dup && dup.id !== id) throw conflict('Já existe um fornecedor com este CNPJ/CPF.');
  }

  const updated = await fornecedorRepository.update(id, data);
  await auditService.log({
    userId: actor.id,
    action: 'ALTERAR',
    module: 'Fornecedores',
    recordId: `forn:${id}`,
    description: `Fornecedor atualizado: ${updated.name}`,
    ip: actor.ip,
  });
  return updated;
}

async function remove(id, actor) {
  const target = await fornecedorRepository.findById(id);
  if (!target) throw notFound('Fornecedor não encontrado.');

  const compras = await fornecedorRepository.countPurchases(id);
  if (compras > 0) {
    throw badRequest('Não é possível excluir: este fornecedor possui compras registradas. Inative-o em vez de excluir.');
  }

  await fornecedorRepository.remove(id);
  await auditService.log({
    userId: actor.id,
    action: 'EXCLUIR',
    module: 'Fornecedores',
    recordId: `forn:${id}`,
    description: `Fornecedor removido: ${target.name}`,
    ip: actor.ip,
  });
  return true;
}

module.exports = { list, get, create, update, remove };
