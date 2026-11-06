// Regras de negócio do desperdício.
// A baixa acontece na MESMA transação das movimentações: ou tudo é gravado
// (registro + alocações por lote + movimentos), ou nada é alterado.
const repo = require('./desperdicio.repository');
const mov = require('../movimentacoes/movimentacao.repository');
const movimentacaoService = require('../movimentacoes/movimentacao.service');
const auditService = require('../audit/audit.service');
const { MOTIVO_LABELS } = require('./desperdicio.validator');
const { badRequest, notFound, conflict } = require('../../utils/errors');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const fmtQty = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const fmtMoney = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Vencidos primeiro (é o caso mais comum de perda), depois FEFO normal.
function ordenarParaPerda(lotes) {
  return [...lotes].sort((a, b) => {
    const va = a.status === 'vencido' ? 0 : 1;
    const vb = b.status === 'vencido' ? 0 : 1;
    if (va !== vb) return va - vb;
    return a.expires_date < b.expires_date ? -1 : a.expires_date > b.expires_date ? 1 : a.id - b.id;
  });
}

function custoDoLote(lote, produto) {
  const custoLote = Number(lote.unit_cost) || 0;
  return custoLote > 0 ? custoLote : Number(produto.reference_cost) || 0;
}

async function create(data, actor) {
  const { wasteId, descricao } = await mov.withTransaction(async (conn) => {
    await mov.marcarVencidos(conn);

    const produto = await mov.encontrarProduto(conn, data.product_id);
    if (!produto) throw notFound('Produto não encontrado.');
    if (produto.status !== 'ativo') throw badRequest('Produto inativo: reative o produto antes de registrar perdas.');

    const lotes = ordenarParaPerda(
      await mov.lotesFefo(conn, produto.id, { incluirVencidos: true })
    );
    if (!lotes.length) throw conflict('Este produto não tem saldo em lotes para dar baixa por desperdício.');

    const alocacoes = [];

    if (data.batch_id) {
      // Lote escolhido manualmente na tela.
      const lote = lotes.find((l) => l.id === data.batch_id);
      if (!lote) throw notFound('O lote informado não tem saldo disponível para este produto.');
      if (Number(lote.remaining_qty) < data.quantity) {
        throw conflict(`O lote selecionado tem apenas ${Number(lote.remaining_qty)} ${produto.unit_symbol || ''} restante(s).`);
      }
      alocacoes.push({ lote, qty: data.quantity });
    } else {
      // FEFO: vencidos primeiro e, se a quantidade não fechar, segue nos válidos.
      let restante = data.quantity;
      for (const lote of lotes) {
        if (restante <= 0) break;
        const q = Math.min(restante, Number(lote.remaining_qty));
        if (q <= 0) continue;
        alocacoes.push({ lote, qty: q });
        restante -= q;
      }
      if (restante > 0) {
        const disponivel = lotes.reduce((s, l) => s + Number(l.remaining_qty), 0);
        throw conflict(`Estoque disponível: ${fmtQty(disponivel)} ${produto.unit_symbol || ''}. É menor que a perda de ${fmtQty(data.quantity)}.`);
      }
    }

    const totalCost = round2(
      alocacoes.reduce((s, a) => s + a.qty * custoDoLote(a.lote, produto), 0)
    );

    const id = await repo.inserirRegistro(conn, {
      productId: produto.id,
      quantity: data.quantity,
      totalCost,
      reason: data.reason,
      notes: data.notes,
      wasteDate: data.waste_date,
      userId: actor.id,
    });

    for (const { lote, qty } of alocacoes) {
      const unitCost = custoDoLote(lote, produto);
      const atualizado = await mov.aplicarSaldoLote(conn, lote.id, -qty);
      if (!atualizado) throw conflict(`Não foi possível baixar o lote ${lote.code || `#${lote.id}`}.`);

      const movementId = await mov.inserirMovimento(conn, {
        productId: produto.id,
        batchId: lote.id,
        type: 'saida_desperdicio',
        quantity: qty,
        userId: actor.id,
        notes: `Desperdício — ${MOTIVO_LABELS[data.reason]}${data.notes ? `: ${data.notes}` : ''}`,
        reference: `desperdicio:${id}`,
      });

      await repo.inserirAlocacao(conn, {
        wasteId: id,
        batchId: lote.id,
        movementId,
        quantity: qty,
        unitCost,
        totalCost: round2(qty * unitCost),
      });
    }

    return {
      wasteId: id,
      descricao: `Perda de ${fmtQty(data.quantity)} ${produto.unit_symbol || ''} de ${produto.name} — ${MOTIVO_LABELS[data.reason]} (${fmtMoney(totalCost)})`,
    };
  });

  await auditService.log({
    userId: actor.id,
    action: 'DESPERDÍCIO',
    module: 'Desperdício',
    recordId: `desperdicio:${wasteId}`,
    description: descricao,
    ip: actor.ip,
  });

  return repo.buscarPorId(wasteId);
}

// Estorno: devolve ao estoque cada lote baixado (gera movimentos de estorno)
// e marca o registro como estornado, sem apagar histórico.
async function reverse(id, actor) {
  const waste = await repo.buscarPorId(id);
  if (!waste) throw notFound('Registro de desperdício não encontrado.');
  if (waste.status === 'estornado') throw conflict(`O desperdício #${id} já foi estornado.`);

  for (const alocacao of waste.allocations) {
    if (!alocacao.movement_id) continue;
    // Se a movimentação já foi estornada em Movimentações, o saldo já voltou.
    if (await mov.existeEstorno(alocacao.movement_id)) continue;
    await movimentacaoService.reverse(alocacao.movement_id, actor);
  }

  await mov.withTransaction((conn) => repo.marcarEstornado(conn, id));

  await auditService.log({
    userId: actor.id,
    action: 'ESTORNO',
    module: 'Desperdício',
    recordId: `desperdicio:${id}`,
    description: `Desperdício #${id} estornado — ${waste.product_name} (${fmtQty(waste.quantity)} ${waste.unit_symbol || ''}) voltou ao estoque`,
    ip: actor.ip,
  });

  return repo.buscarPorId(id);
}

async function list(filters) {
  return repo.list(filters);
}

module.exports = { create, reverse, list };
