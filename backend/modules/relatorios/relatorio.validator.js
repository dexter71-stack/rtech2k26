// Validação dos filtros de relatórios (query string).
const { badRequest } = require('../../utils/errors');
const { MOTIVOS } = require('../desperdicios/desperdicio.validator');

const TIPOS = ['estoque', 'compras', 'desperdicio', 'validade'];
const COMPRA_STATUS = ['pendente', 'recebida', 'cancelada', 'estornada'];
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

const dataValida = (v) => DATA_RE.test(v) && !Number.isNaN(new Date(`${v}T00:00:00`).getTime());
const texto = (v, max) => String(v || '').trim().slice(0, max) || undefined;

function parseFiltros(tipo, q) {
  if (tipo === 'estoque') {
    return {
      search: texto(q.search, 80),
      status: ['ativo', 'inativo'].includes(q.status) ? q.status : undefined,
      abaixoMinimo: q.abaixoMinimo === '1',
    };
  }

  if (tipo === 'compras') {
    const dateFrom = dataValida(String(q.dateFrom || '')) ? String(q.dateFrom) : undefined;
    const dateTo = dataValida(String(q.dateTo || '')) ? String(q.dateTo) : undefined;
    if (dateFrom && dateTo && dateFrom > dateTo) throw badRequest('A data inicial não pode ser depois da final.');
    return {
      dateFrom,
      dateTo,
      status: COMPRA_STATUS.includes(q.status) ? q.status : undefined,
    };
  }

  if (tipo === 'desperdicio') {
    const dateFrom = dataValida(String(q.dateFrom || '')) ? String(q.dateFrom) : undefined;
    const dateTo = dataValida(String(q.dateTo || '')) ? String(q.dateTo) : undefined;
    if (dateFrom && dateTo && dateFrom > dateTo) throw badRequest('A data inicial não pode ser depois da final.');
    return {
      dateFrom,
      dateTo,
      reason: MOTIVOS.includes(q.reason) ? q.reason : undefined,
      status: ['registrado', 'estornado'].includes(q.status) ? q.status : undefined,
    };
  }

  const dias = Number(q.dias);
  return {
    dias: Number.isFinite(dias) && dias >= 1 && dias <= 3650 ? Math.floor(dias) : 30,
  };
}

module.exports = { parseFiltros, TIPOS };
