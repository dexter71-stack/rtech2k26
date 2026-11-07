// Geração de CSV para os relatórios (Excel pt-BR: ponto e vírgula, BOM e vírgula decimal).
const DATA_RE = /^(\d{4})-(\d{2})-(\d{2})/;

const num = (v, casas) => {
  const n = Number(v);
  if (v === null || v === undefined || v === '' || Number.isNaN(n)) return '';
  return n.toFixed(casas).replace('.', ',');
};

function formatarValor(valor, tipo) {
  if (valor === null || valor === undefined) return '';
  switch (tipo) {
    case 'numero': return num(valor, 3).replace(/,0+$/, '') || '0';
    case 'dinheiro': return num(valor, 2);
    case 'data': {
      const m = DATA_RE.exec(String(valor));
      return m ? `${m[3]}/${m[2]}/${m[1]}` : String(valor);
    }
    case 'datahora': {
      const m = DATA_RE.exec(String(valor));
      if (!m) return String(valor);
      const hora = String(valor).slice(11, 16);
      return `${m[3]}/${m[2]}/${m[1]}${hora ? ` ${hora}` : ''}`;
    }
    default: return String(valor);
  }
}

function celula(valor, tipo) {
  let texto = formatarValor(valor, tipo);
  // Evita que um texto do banco seja interpretado como fórmula no Excel.
  if (tipo === 'texto' && /^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /["\n\r;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function gerarCsv(colunas, linhas) {
  const cabecalho = colunas.map((c) => celula(c.label, 'texto')).join(';');
  const corpo = linhas.map((linha) =>
    colunas.map((c) => celula(linha[c.key], c.type)).join(';')
  );
  return [cabecalho, ...corpo].join('\r\n') + '\r\n';
}

function enviarCsv(res, nomeArquivo, conteudo) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
  res.send('\uFEFF' + conteudo);
}

module.exports = { gerarCsv, enviarCsv, formatarValor };
