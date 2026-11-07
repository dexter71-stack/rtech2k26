// Regras de negócio de alertas operacionais.
const alertaRepository = require('./alerta.repository');
const loteRepository = require('../lotes/lote.repository');
const configuracaoService = require('../configuracoes/configuracao.service');

async function alertas({ dias } = {}) {
  // Normaliza o status de lotes vencidos antes de calcular.
  await loteRepository.marcarVencidos();

  // Sem dias explícitos, usa a janela configurada em Configurações.
  const config = await configuracaoService.obter().catch(() => ({ alertDays: 7 }));
  const janela = Math.min(90, Math.max(1, Number(dias) || config.alertDays || 7));

  const [baixoEstoque, semEstoque, vencendo, vencidos] = await Promise.all([
    alertaRepository.produtosBaixoEstoque(),
    alertaRepository.produtosSemEstoque(),
    alertaRepository.lotesVencendo(janela),
    alertaRepository.lotesVencidos(),
  ]);

  return {
    geradoEm: new Date(),
    janelaDias: janela,
    baixoEstoque,
    semEstoque,
    vencendo: vencendo,
    vencidos: vencidos,
    totalAlertas: baixoEstoque.length + semEstoque.length + vencendo.length + vencidos.length,
  };
}

module.exports = { alertas };
