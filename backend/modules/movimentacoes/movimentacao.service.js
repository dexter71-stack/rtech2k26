// Regras de negócio de movimentações de estoque (usando transação SQL).
// Leitura de dados AINDA NÃO commitados só pode ser feita pela conexão `conn`;
// consultas por `pool` visam dados já persistidos (usadas pós-commit).
const repo = require('./movimentacao.repository');
const auditService = require('../audit/audit.service');
const { LABELS } = require('./movimentacao.validator');
const { badRequest, forbidden, notFound, conflict } = require('../../utils/errors');

const AUDIT_ACTION = {
  entrada: 'ENTRADA',
  entrada_compra: 'ENTRADA',
  entrada_ajuste: 'ENTRADA',
  saida: 'SAÍDA',
  saida_desperdicio: 'DESPERDÍCIO',
  saida_ajuste: 'SAÍDA',
  estorno: 'ESTORNO',
};

// Papéis autorizados a criar movimentações de entrada (compra/ajuste de lote).
const podeEntrada = (role) => role === 'admin' || role === 'gerente';

function formatarEvento(tipo, produtoName, qty, symbol) {
  return `${LABELS[tipo]} de ${qty}${symbol ? ` ${symbol}` : ''} — ${produtoName}`;
}

async function create(data, actor) {
  if (data.type.startsWith('entrada') && !podeEntrada(actor.role)) {
    throw forbidden('Somente administrador ou gerente registra entradas de estoque.');
  }

  // A transação devolve apenas IDs/valores já resolvidos com `conn`.
  const { movementIds } = await repo.withTransaction(async (conn) => {
    await repo.marcarVencidos(conn);

    const produto = await repo.encontrarProduto(conn, data.product_id);
    if (!produto) throw notFound('Produto não encontrado.');
    if (produto.status !== 'ativo') throw badRequest('Produto inativo: reative o produto antes de movimentar.');

    const movementIds = [];
    if (data.type.startsWith('entrada')) {
      if (data.expires_date < data.received_date) {
        throw badRequest('A validade do lote não pode ser anterior à data de recebimento.');
      }
      const lote = await repo.criarLote(conn, { productId: produto.id, data, actorId: actor.id });
      const id = await repo.inserirMovimento(conn, {
        productId: produto.id,
        batchId: lote.id,
        type: data.type,
        quantity: data.quantity,
        userId: actor.id,
        notes: data.notes,
        reference: data.type === 'entrada_compra' && data.supplier_name ? `NF ${data.supplier_name}` : 'ajuste manual',
      });
      movementIds.push(id);
    } else {
      // Saída: FEFO. Desperdício prioriza lotes VENCIDOS; uso só consome lotes na validade.
      const desperdicio = data.type === 'saida_desperdicio';
      let restante = data.quantity;
      const alocacoes = [];

      if (desperdicio) {
        // Espurgo vencidos primeiro (Status), depois oldest expiry (order SQL).
        let lotes = await repo.lotesFefo(conn, produto.id, { incluirVencidos: true, loteEspecifico: data.batch_id || null });
        lotes.sort((a, b) => {
          const va = a.status === 'vencido' ? 0 : 1;
          const vb = b.status === 'vencido' ? 0 : 1;
          if (va !== vb) return va - vb;
          return a.expires_date < b.expires_date ? -1 : a.expires_date > b.expires_date ? 1 : 0;
        });

        if (data.batch_id) {
          const alvo = lotes.find((l) => l.id === data.batch_id);
          if (!alvo) throw notFound('O lote informado não está disponível com saldo para este produto.');
          if (Number(alvo.remaining_qty) < data.quantity) {
            throw conflict(`O lote selecionado tem apenas ${Number(alvo.remaining_qty)} restante(s).`);
          }
          alocacoes.push({ lote: alvo, qty: data.quantity });
          restante = 0;
        } else {
          for (const lote2 of lotes) {
            if (restante <= 0) break;
            if (lote2.status !== 'vencido' && alocacoes.length > 0) break; // lote válido alguém escolheu explicitamente
            const q = Math.min(restante, Number(lote2.remaining_qty));
            if (q <= 0) continue;
            alocacoes.push({ lote: lote2, qty: q });
            restante -= q;
          }
          if (restante > 0) {
            const alvo = lotes.find((l) => l.status !== 'vencido');
            if (alvo) throw conflict('A baixa por desperdício exige escolher explicitamente o lote válido a perder (nenhum lote vencido alcançou a quantidade).');
          }
        }
      } else {
        const lotes = await repo.lotesFefo(conn, produto.id, { incluirVencidos: false, loteEspecifico: data.batch_id || null });
        if (data.batch_id) {
          const alvo = lotes.find((l) => l.id === data.batch_id);
          if (!alvo) throw notFound('O lote informado não está disponível com saldo para este produto.');
          if (Number(alvo.remaining_qty) < data.quantity) {
            throw conflict(`O lote selecionado tem apenas ${Number(alvo.remaining_qty)} restante(s). Oriente baixa sem lote específico para consumir em FEFO (multi-lote).`);
          }
          alocacoes.push({ lote: alvo, qty: data.quantity });
          restante = 0;
        } else {
          const disponivel = lotes.reduce((s, l) => s + Number(l.remaining_qty), 0);
          if (disponivel < data.quantity) {
            throw conflict(`Estoque disponível (lotes na validade): ${disponivel}${produto.unit_symbol ? ` ${produto.unit_symbol}` : ''}. É menor que a baixa solicitada de ${data.quantity}.`);
          }
          for (const lote2 of lotes) {
            if (restante <= 0) break;
            const q = Math.min(restante, Number(lote2.remaining_qty));
            if (q <= 0) continue;
            alocacoes.push({ lote: lote2, qty: q });
            restante -= q;
          }
        }
      }

      if (alocacoes.length === 0 || alocacoes.reduce((s, a) => s + a.qty, 0) < data.quantity) {
        throw conflict('Não há saldo suficiente para esta baixa.');
      }

      for (const { lote: lote2, qty } of alocacoes) {
        await repo.aplicarSaldoLote(conn, lote2.id, -qty);
        const id = await repo.inserirMovimento(conn, {
          productId: produto.id,
          batchId: lote2.id,
          type: data.type,
          quantity: qty,
          userId: actor.id,
          notes: data.notes,
          reference: alocacoes.length > 1 ? `FEFO lote ${lote2.code || `#${lote2.id}`}` : null,
        });
        movementIds.push(id);
      }
    }

    return { movementIds };
  });

  // Auditoria e leitura das movimentações APÓS o commit (visíveis para o pool).
  const movimentacoes = await Promise.all(movementIds.map((id) => repo.consultarMovimento(id)));
  for (const mov of movimentacoes) {
    await auditService.log({
      userId: actor.id,
      action: AUDIT_ACTION[data.type],
      module: 'Estoque',
      recordId: `mov:${mov.id}`,
      description: formatarEvento(data.type, mov.product_name, mov.quantity, mov.unit_symbol),
      ip: actor.ip,
    });
  }
  return { movement: movimentacoes[0], movimentacoes };
}

// Estorno: compensa a movimentação original (auditável, sem deletar histórico).
async function reverse(movementId, actor) {
  const { estornoId } = await repo.withTransaction(async (conn) => {
    await repo.marcarVencidos(conn);

    const original = await repo.consultarMovimento(movementId);
    if (!original) throw notFound('Movimentação não encontrada.');
    if (original.type === 'estorno') throw badRequest('Estornos não podem ser estornados: registre uma nova movimentação para corrigir.');
    if (await repo.existeEstorno(movementId)) throw conflict(`A movimentação #${movementId} já foi estornada.`);

    const produto = await repo.encontrarProduto(conn, original.product_id);
    if (!produto) throw notFound('Produto da movimentação não encontrado.');
    if (!original.batch_id) throw badRequest('Movimentação sem lote vinculado: registre um ajuste manual para corrigir.');

    const lote = await repo.buscarLoteParaAtualizar(conn, original.batch_id);
    if (!lote) throw notFound('Lote da movimentação não encontrado.');

    if (original.type.startsWith('entrada')) {
      // Exhaust: devolve o estoque ao nível anterior (subtrai do lote).
      if (Number(lote.remaining_qty) < original.quantity) {
        throw conflict(`Não é possível estornar por completo: o lote original já teve ${Number(lote.received_qty) - Number(lote.remaining_qty)} consumido(s) após a entrada.`);
      }
      if (lote.status !== 'ativo' && lote.status !== 'esgotado') {
        throw conflict(`Lote ${lote.status === 'vencido' ? 'vencido' : 'cancelado'}: estorno de entrada não permitido. Corrija com um ajuste manual.`);
      }
      await repo.aplicarSaldoLote(conn, lote.id, -original.quantity);
    } else {
      // Devolve o que saiu (reentrada no lote).
      if (lote.status === 'cancelado') throw conflict('Lote cancelado: estorno não permitido.');
      await repo.aplicarSaldoLote(conn, lote.id, +original.quantity);
    }

    const estornoId = await repo.inserirMovimento(conn, {
      productId: original.product_id,
      batchId: original.batch_id,
      type: 'estorno',
      quantity: original.quantity,
      userId: actor.id,
      notes: `Estorno do movimento #${original.id}${original.notes ? ` — ${original.notes}` : ''}`,
      reference: `mov:${original.id}`,
    });
    return { estornoId };
  });

  const movement = await repo.consultarMovimento(estornoId);
  await auditService.log({
    userId: actor.id,
    action: 'ESTORNO',
    module: 'Estoque',
    recordId: `mov:${estornoId}`,
    description: `Estorno do movimento #${movementId} — ${movement.product_name}`,
    ip: actor.ip,
  });
  return movement;
}

async function list(filters) {
  return repo.list(filters);
}

module.exports = { create, reverse, list };
