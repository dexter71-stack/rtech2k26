// Handlers HTTP do dashboard.
const repository = require('./dashboard.repository');
const configuracaoService = require('../configuracoes/configuracao.service');
const { asyncHandler } = require('../../utils/errors');

exports.summary = asyncHandler(async (req, res) => {
  // A janela de validade vem dos parâmetros da galeteria (Configurações).
  const { alertDays } = await configuracaoService.obter();
  res.json(await repository.summary(req.user.id, alertDays));
});
