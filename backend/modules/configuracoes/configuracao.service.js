// Regras de negócio dos parâmetros do sistema.
const repo = require('./configuracao.repository');
const auditService = require('../audit/audit.service');

async function obter() {
  return repo.obter();
}

async function atualizar(data, actor) {
  await repo.salvar(data, actor.id);

  await auditService.log({
    userId: actor.id,
    action: 'CONFIGURAÇÃO',
    module: 'Configurações',
    recordId: 'configuracoes',
    description: `Atualizou os parâmetros da galeteria (alerta de validade: ${data.alert_days} dia(s))`,
    ip: actor.ip,
  });

  return repo.obter();
}

module.exports = { obter, atualizar };
