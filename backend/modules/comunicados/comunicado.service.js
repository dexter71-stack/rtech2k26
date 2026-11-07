// Regras de negócio do mural de comunicados.
const repo = require('./comunicado.repository');
const auditService = require('../audit/audit.service');
const { notFound, conflict } = require('../../utils/errors');
const { PRIORIDADE_LABELS } = require('./comunicado.validator');

async function list(filters) {
  const [lista, resumo] = await Promise.all([
    repo.list(filters),
    repo.resumo(filters.userId),
  ]);
  return {
    ...lista,
    resumo: {
      ativos: Number(resumo.ativos) || 0,
      naoLidos: Number(resumo.nao_lidos) || 0,
      alta: Number(resumo.alta) || 0,
    },
  };
}

async function create(data, actor) {
  const id = await repo.create({
    title: data.title,
    message: data.message,
    priority: data.priority,
    userId: actor.id,
  });

  await auditService.log({
    userId: actor.id,
    action: 'COMUNICADO',
    module: 'Comunicação',
    recordId: `comunicado:${id}`,
    description: `Publicou o comunicado “${data.title}” (prioridade ${PRIORIDADE_LABELS[data.priority].toLowerCase()})`,
    ip: actor.ip,
  });

  return repo.findById(id, actor.id);
}

async function marcarLido(id, actor) {
  const comunicado = await repo.findById(id, actor.id);
  if (!comunicado) throw notFound('Comunicado não encontrado.');
  if (comunicado.status !== 'ativo') throw conflict('Este comunicado foi arquivado.');
  await repo.marcarLido(id, actor.id);
  return repo.findById(id, actor.id);
}

async function alterarStatus(id, status, actor) {
  const comunicado = await repo.findById(id, actor.id);
  if (!comunicado) throw notFound('Comunicado não encontrado.');
  if (comunicado.status === status) {
    throw conflict(status === 'arquivado' ? 'Este comunicado já está arquivado.' : 'Este comunicado já está no mural.');
  }

  await repo.alterarStatus(id, status);

  await auditService.log({
    userId: actor.id,
    action: status === 'arquivado' ? 'ARQUIVAMENTO' : 'COMUNICADO',
    module: 'Comunicação',
    recordId: `comunicado:${id}`,
    description: `${status === 'arquivado' ? 'Arquivou' : 'Reabriu'} o comunicado “${comunicado.title}”`,
    ip: actor.ip,
  });

  return repo.findById(id, actor.id);
}

async function leituras(id, actor) {
  const comunicado = await repo.findById(id, actor.id);
  if (!comunicado) throw notFound('Comunicado não encontrado.');
  return {
    comunicado: { id: comunicado.id, title: comunicado.title, read_count: comunicado.read_count, active_users: comunicado.active_users },
    rows: await repo.leituras(id),
  };
}

module.exports = { list, create, marcarLido, alterarStatus, leituras };
