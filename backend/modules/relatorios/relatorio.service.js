// Regras de apresentação dos relatórios: colunas, resumo e linhas.
// Tudo vem do banco; o frontend apenas formata os tipos declarados aqui.
const repo = require('./relatorio.repository');
const { MOTIVO_LABELS } = require('../desperdicios/desperdicio.validator');

const COMPRA_STATUS = { pendente: 'Pendente', recebida: 'Recebida', cancelada: 'Cancelada', estornada: 'Estornada' };
const LOTE_STATUS = { ativo: 'Ativo', vencido: 'Vencido', esgotado: 'Esgotado', cancelado: 'Cancelado' };

const resumoItem = (label, valor, tipo) => ({ label, valor, tipo });

async function gerarEstoque(filtros) {
  const { rows, resumo, limite } = await repo.estoque(filtros);
  return {
    tipo: 'estoque',
    titulo: 'Posição de estoque',
    nota: 'Saldo real somado dos lotes ativos/vencidos. Valor calculado pelo custo do lote (ou custo de referência quando o lote não tem custo).',
    limite,
    colunas: [
      { key: 'name', label: 'Produto', type: 'texto' },
      { key: 'category_name', label: 'Categoria', type: 'texto' },
      { key: 'estoque', label: 'Estoque', type: 'numero' },
      { key: 'unit_symbol', label: 'Unidade', type: 'texto' },
      { key: 'min_stock', label: 'Mínimo', type: 'numero' },
      { key: 'valor', label: 'Valor em estoque', type: 'dinheiro' },
      { key: 'status', label: 'Status', type: 'texto' },
    ],
    resumo: [
      resumoItem('Produtos', resumo.total, 'numero'),
      resumoItem('Valor em estoque', resumo.valor, 'dinheiro'),
      resumoItem('Abaixo do mínimo', resumo.baixo, 'numero'),
      resumoItem('Sem estoque', resumo.sem_estoque, 'numero'),
    ],
    linhas: rows,
  };
}

async function gerarCompras(filtros) {
  const { rows, resumo, limite } = await repo.compras(filtros);
  return {
    tipo: 'compras',
    titulo: 'Compras por período',
    nota: 'Data do pedido. O valor considera o total de cada pedido; compras estornadas não entram no total recebido.',
    limite,
    colunas: [
      { key: 'id', label: 'Pedido', type: 'texto' },
      { key: 'supplier_name', label: 'Fornecedor', type: 'texto' },
      { key: 'order_date', label: 'Pedido em', type: 'data' },
      { key: 'received_date', label: 'Recebido em', type: 'data' },
      { key: 'status', label: 'Situação', type: 'texto' },
      { key: 'item_count', label: 'Itens', type: 'numero' },
      { key: 'invoice_number', label: 'Nota fiscal', type: 'texto' },
      { key: 'total_amount', label: 'Total', type: 'dinheiro' },
    ],
    resumo: [
      resumoItem('Pedidos', resumo.total, 'numero'),
      resumoItem('Recebidos', resumo.recebidas, 'numero'),
      resumoItem('Pendentes', resumo.pendentes, 'numero'),
      resumoItem('Total recebido', resumo.valor, 'dinheiro'),
    ],
    linhas: rows.map((r) => ({ ...r, id: `#${r.id}`, status: COMPRA_STATUS[r.status] || r.status })),
  };
}

async function gerarDesperdicio(filtros) {
  const { rows, resumo, limite } = await repo.desperdicio(filtros);
  return {
    tipo: 'desperdicio',
    titulo: 'Desperdício por período',
    nota: 'Perdas estornadas aparecem no histórico, mas não somam quantidade nem prejuízo.',
    limite,
    colunas: [
      { key: 'waste_date', label: 'Data', type: 'data' },
      { key: 'product_name', label: 'Produto', type: 'texto' },
      { key: 'batch_codes', label: 'Lote(s)', type: 'texto' },
      { key: 'reason', label: 'Motivo', type: 'texto' },
      { key: 'quantity', label: 'Quantidade', type: 'numero' },
      { key: 'unit_symbol', label: 'Unidade', type: 'texto' },
      { key: 'total_cost', label: 'Prejuízo', type: 'dinheiro' },
      { key: 'status', label: 'Situação', type: 'texto' },
      { key: 'user_name', label: 'Registrado por', type: 'texto' },
    ],
    resumo: [
      resumoItem('Registros', resumo.registros, 'numero'),
      resumoItem('Estornados', resumo.estornados, 'numero'),
      resumoItem('Quantidade perdida', resumo.quantidade, 'numero'),
      resumoItem('Prejuízo', resumo.custo, 'dinheiro'),
    ],
    linhas: rows.map((r) => ({
      ...r,
      reason: MOTIVO_LABELS[r.reason] || r.reason,
      status: r.status === 'estornado' ? 'Estornado' : 'Registrado',
    })),
  };
}

async function gerarValidade(filtros) {
  const { rows, resumo, limite } = await repo.validade(filtros);
  return {
    tipo: 'validade',
    titulo: 'Lotes e validade',
    nota: `Lotes com saldo vencendo em até ${filtros.dias} dia(s) — os já vencidos entram na lista.`,
    limite,
    colunas: [
      { key: 'code', label: 'Lote', type: 'texto' },
      { key: 'product_name', label: 'Produto', type: 'texto' },
      { key: 'remaining_qty', label: 'Saldo', type: 'numero' },
      { key: 'unit_symbol', label: 'Unidade', type: 'texto' },
      { key: 'expires_date', label: 'Validade', type: 'data' },
      { key: 'dias', label: 'Dias p/ vencer', type: 'texto' },
      { key: 'valor', label: 'Valor em risco', type: 'dinheiro' },
      { key: 'supplier_name', label: 'Fornecedor', type: 'texto' },
      { key: 'status', label: 'Situação', type: 'texto' },
    ],
    resumo: [
      resumoItem('Lotes no período', resumo.total, 'numero'),
      resumoItem('Vencidos', resumo.vencidos, 'numero'),
      resumoItem('Vencem em 7 dias', resumo.semana, 'numero'),
      resumoItem('Valor em risco', resumo.valor, 'dinheiro'),
    ],
    linhas: rows.map((r) => ({
      ...r,
      dias: Number(r.dias) < 0 ? `vencido há ${Math.abs(Number(r.dias))}d` : `${r.dias}d`,
      status: LOTE_STATUS[r.status] || r.status,
    })),
  };
}

async function gerar(tipo, filtros) {
  const dados = tipo === 'estoque' ? await gerarEstoque(filtros)
    : tipo === 'compras' ? await gerarCompras(filtros)
      : tipo === 'desperdicio' ? await gerarDesperdicio(filtros)
        : await gerarValidade(filtros);

  return { ...dados, geradoEm: new Date().toISOString() };
}

module.exports = { gerar };
