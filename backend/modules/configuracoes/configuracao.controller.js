// Handlers HTTP dos parâmetros do sistema.
const service = require('./configuracao.service');
const { asyncHandler } = require('../../utils/errors');

// Leitura autenticada: o layout usa o nome do estabelecimento em todas as páginas.
exports.obter = asyncHandler(async (req, res) => {
  res.json({ settings: await service.obter() });
});

exports.atualizar = asyncHandler(async (req, res) => {
  const settings = await service.atualizar(req.configuracaoData, { ...req.user, ip: req.ip });
  res.json({ settings });
});
