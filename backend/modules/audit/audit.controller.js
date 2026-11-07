// Handlers HTTP da auditoria (somente administrador, controlado na rota).
const auditService = require('./audit.service');
const { asyncHandler, badRequest } = require('../../utils/errors');
const { gerarCsv, enviarCsv } = require('../../utils/csv');

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const dataValida = (v) => DATA_RE.test(v) && !Number.isNaN(new Date(`${v}T00:00:00`).getTime());

function filtrosDe(req) {
  const { module, action, user, dateFrom, dateTo } = req.query;

  for (const d of [dateFrom, dateTo]) {
    if (d && !dataValida(String(d))) throw badRequest('Data inválida.');
  }
  if (dateFrom && dateTo && String(dateFrom) > String(dateTo)) {
    throw badRequest('A data inicial não pode ser depois da final.');
  }

  return {
    moduleName: String(module || '').trim().slice(0, 60) || undefined,
    action: String(action || '').trim().slice(0, 60) || undefined,
    userName: String(user || '').trim().slice(0, 100) || undefined,
    dateFrom: dateFrom ? String(dateFrom) : undefined,
    dateTo: dateTo ? String(dateTo) : undefined,
  };
}

exports.list = asyncHandler(async (req, res) => {
  const filtros = filtrosDe(req);

  // Exportação CSV: mesmo recorte dos filtros, sem paginação (limite de segurança).
  if (req.query.format === 'csv') {
    const result = await auditService.list({ ...filtros, page: 1, pageSize: 5000 });
    const colunas = [
      { key: 'created_at', label: 'Quando', type: 'datahora' },
      { key: 'user_name', label: 'Usuário', type: 'texto' },
      { key: 'action', label: 'Ação', type: 'texto' },
      { key: 'module', label: 'Módulo', type: 'texto' },
      { key: 'record_id', label: 'Registro', type: 'texto' },
      { key: 'description', label: 'Descrição', type: 'texto' },
      { key: 'ip', label: 'IP', type: 'texto' },
    ];
    const nome = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    return enviarCsv(res, nome, gerarCsv(colunas, result.rows));
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize) || 25));
  res.json(await auditService.list({ ...filtros, page, pageSize }));
});
