// Lógica de compras: pedido com itens, recebimento no estoque e cancelamento.
const compraRepository = require('./compra.repository');
const fornecedorRepository = require('../fornecedores/fornecedor.repository');
const auditService = require('../audit/audit.service');
const { badRequest, notFound, conflict } = require('../../utils/errors');

const brl = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

function list(filters) {
  return compraRepository.list(filters);
}

async function get(id) {
  const compra = await compraRepository.findById(id);
  if (!compra) throw notFound('Compra não encontrada.');
  return compra;
}

// Confere fornecedor e produtos antes de gravar o pedido.
async function conferirCadastros(data) {
  const fornecedor = await fornecedorRepository.findById(data.supplier_id);
  if (!fornecedor) throw badRequest('Fornecedor não encontrado.');
  if (fornecedor.status !== 'ativo') throw badRequest('Este fornecedor está inativo e não pode receber novas compras.');

  const ids = [...new Set(data.items.map((i) => i.product_id))];
  const produtos = await compraRepository.findProdutos(ids);
  const porId = new Map(produtos.map((p) => [p.id, p]));
  const problemas = [];
  for (const item of data.items) {
    const produto = porId.get(item.product_id);
    if (!produto) problemas.push(`Produto #${item.product_id} não encontrado.`);
    else if (produto.status !== 'ativo') problemas.push(`O produto "${produto.name}" está inativo.`);
  }
  if (problemas.length) throw badRequest('Itens inválidos na compra.', problemas);
  return fornecedor;
}

async function create(data, actor) {
  const fornecedor = await conferirCadastros(data);
  const compra = await compraRepository.create(data, actor.id);
  await auditService.log({
    userId: actor.id,
    action: 'CRIAR',
    module: 'Compras',
    recordId: `compra:${compra.id}`,
    description: `Compra #${compra.id} registrada — ${fornecedor.name} (${compra.items.length} item(ns), ${brl(compra.total_amount)})`,
    ip: actor.ip,
  });
  return compra;
}

async function update(id, data, actor) {
  const target = await compraRepository.findById(id);
  if (!target) throw notFound('Compra não encontrada.');
  if (target.status !== 'pendente') throw conflict('Somente compras pendentes podem ser editadas.');
  if (data.supplier_id !== undefined) {
    const fornecedor = await fornecedorRepository.findById(data.supplier_id);
    if (!fornecedor) throw badRequest('Fornecedor não encontrado.');
  }
  if (Array.isArray(data.items)) {
    const ids = [...new Set(data.items.map((i) => i.product_id))];
    const produtos = await compraRepository.findProdutos(ids);
    const porId = new Map(produtos.map((p) => [p.id, p]));
    const problemas = data.items
      .filter((i) => !porId.get(i.product_id) || porId.get(i.product_id).status !== 'ativo')
      .map((i) => `Produto #${i.product_id} inválido ou inativo.`);
    if (problemas.length) throw badRequest('Itens inválidos na compra.', problemas);
  }
  const updated = await compraRepository.update(id, data);
  await auditService.log({
    userId: actor.id,
    action: 'ALTERAR',
    module: 'Compras',
    recordId: `compra:${id}`,
    description: `Compra #${id} atualizada — ${updated.supplier_name} (${brl(updated.total_amount)})`,
    ip: actor.ip,
  });
  return updated;
}

async function receive(id, data, actor) {
  const target = await compraRepository.findById(id);
  if (!target) throw notFound('Compra não encontrada.');
  if (target.status === 'recebida') throw conflict('Esta compra já foi recebida.');
  if (target.status === 'cancelada') throw conflict('Compra cancelada não pode ser recebida.');
  if (data.received_date && data.received_date < target.order_date) {
    throw badRequest('A data de recebimento não pode ser anterior à data do pedido.');
  }

  let result;
  try {
    result = await compraRepository.receive(id, data, actor.id);
  } catch (err) {
    const msg = String(err.message || '');
    if (msg === 'PURCHASE_NOT_FOUND') throw notFound('Compra não encontrada.');
    if (msg === 'PURCHASE_EMPTY') throw badRequest('A compra não possui itens para receber.');
    if (msg.startsWith('PURCHASE_STATUS:')) throw conflict('Esta compra não está mais pendente.');
    if (msg.startsWith('PRODUTO_INATIVO:')) {
      throw badRequest(`Não é possível receber: produto(s) inativo(s) — ${msg.split(':')[1]}.`);
    }
    throw err;
  }

  await auditService.log({
    userId: actor.id,
    action: 'RECEBER',
    module: 'Compras',
    recordId: `compra:${id}`,
    description: `Compra #${id} recebida — ${result.itens} lote(s) deram entrada no estoque (${target.supplier_name})`,
    ip: actor.ip,
  });
  return result.purchase;
}

async function cancel(id, actor) {
  const target = await compraRepository.findById(id);
  if (!target) throw notFound('Compra não encontrada.');
  if (target.status !== 'pendente') throw conflict('Somente compras pendentes podem ser canceladas.');

  const affected = await compraRepository.cancel(id);
  if (!affected) throw conflict('Esta compra não está mais pendente.');

  await auditService.log({
    userId: actor.id,
    action: 'CANCELAR',
    module: 'Compras',
    recordId: `compra:${id}`,
    description: `Compra #${id} cancelada — ${target.supplier_name}`,
    ip: actor.ip,
  });
  return get(id);
}

// Estorno: devolve ao fornecedor os lotes de uma compra recebida, em transação.
async function reverse(id, actor) {
  const target = await compraRepository.findById(id);
  if (!target) throw notFound('Compra não encontrada.');
  if (target.status === 'pendente') throw conflict('Pedido pendente não pode ser estornado: use Cancelar pedido.');
  if (target.status === 'cancelada') throw conflict('Esta compra já está cancelada.');
  if (target.status === 'estornada') throw conflict('Esta compra já foi estornada.');

  let result;
  try {
    result = await compraRepository.reverse(id, actor.id);
  } catch (err) {
    const msg = String(err.message || '');
    if (msg === 'PURCHASE_NOT_FOUND') throw notFound('Compra não encontrada.');
    if (msg === 'PURCHASE_SEM_ENTRADA') {
      throw conflict('Esta compra não possui entradas no estoque para estornar.');
    }
    if (msg.startsWith('PURCHASE_STATUS:')) throw conflict('Somente compras recebidas podem ser estornadas.');
    if (msg.startsWith('LOTE_CONSUMIDO:')) {
      const [, produto, consumido] = msg.split(':');
      throw conflict(`Item "${produto}": o lote já teve ${Number(consumido)} consumido(s) após o recebimento. Estorne a baixa antes de devolver a compra.`);
    }
    if (msg.startsWith('LOTE_AUSENTE:')) {
      throw conflict(`Item "${msg.split(':')[1]}": lote de entrada não encontrado para devolução.`);
    }
    throw err;
  }

  await auditService.log({
    userId: actor.id,
    action: 'ESTORNO',
    module: 'Compras',
    recordId: `compra:${id}`,
    description: `Compra #${id} estornada — ${result.itens} lote(s) devolvido(s) ao fornecedor (${target.supplier_name}, ${brl(target.total_amount)})`,
    ip: actor.ip,
  });
  return get(id);
}

module.exports = { list, get, create, update, receive, cancel, reverse };
