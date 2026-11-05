// Regras de negócio de alertas operacionais.
const alertaRepository = require('./alerta.repository');
const loteRepository = require('../lotes/lote.repository');

async function alertas({ dias = 7 } = {}) {
  // Normaliza o status de lotes vencidos antes de calcular.
  await loteRepository.marcarVencidos();

  const janela = Math.min(60, Math.max(1, Number(dias) || 7));

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
