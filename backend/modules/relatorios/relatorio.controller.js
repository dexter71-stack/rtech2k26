// Handlers HTTP dos relatórios: JSON para a tela e CSV para download.
const service = require('./relatorio.service');
const { parseFiltros, TIPOS } = require('./relatorio.validator');
const { asyncHandler, notFound, forbidden } = require('../../utils/errors');
const { gerarCsv, enviarCsv } = require('../../utils/csv');

exports.gerar = asyncHandler(async (req, res) => {
  const tipo = TIPOS.includes(req.params.tipo) ? req.params.tipo : null;
  if (!tipo) throw notFound('Relatório não encontrado.');

  // Compras envolvem valores de fornecedores: restrito como no módulo de compras.
  if (tipo === 'compras' && !['admin', 'gerente'].includes(req.user.role)) {
    throw forbidden('Apenas administrador ou gerente pode consultar o relatório de compras.');
  }

  const filtros = parseFiltros(tipo, req.query);
  const relatorio = await service.gerar(tipo, filtros);

  if (req.query.format === 'csv') {
    const nome = `relatorio-${tipo}-${new Date().toISOString().slice(0, 10)}.csv`;
    return enviarCsv(res, nome, gerarCsv(relatorio.colunas, relatorio.linhas));
  }

  res.json(relatorio);
});
