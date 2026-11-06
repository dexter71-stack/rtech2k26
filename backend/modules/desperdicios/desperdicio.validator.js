// Validação do registro de desperdício no backend.
const { ApiError } = require('../../utils/errors');

const MOTIVOS = ['vencido', 'avaria', 'preparo', 'sobra', 'outro'];
const MOTIVO_LABELS = {
  vencido: 'Passou da validade',
  avaria: 'Avaria / dano',
  preparo: 'Erro de preparo',
  sobra: 'Sobra de produção',
  outro: 'Outro motivo',
};

const hojeISO = () => new Date().toISOString().slice(0, 10);
const validaData = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))
  && !Number.isNaN(new Date(`${v}T00:00:00`).getTime());

function parseQty(v) {
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n > 999999) return NaN;
  return n;
}

function validateCreate(req, res, next) {
  const errors = [];
  const data = {};
  const b = req.body || {};

  const productId = Number(b.product_id);
  if (!Number.isInteger(productId) || productId <= 0) errors.push('Selecione o produto perdido.');
  else data.product_id = productId;

  const qty = parseQty(b.quantity);
  if (Number.isNaN(qty)) errors.push('Informe uma quantidade maior que zero.');
  else data.quantity = qty;

  if (!MOTIVOS.includes(b.reason)) errors.push('Selecione o motivo da perda.');
  else data.reason = b.reason;

  const batchId = Number(b.batch_id);
  if (b.batch_id && (!Number.isInteger(batchId) || batchId <= 0)) errors.push('Lote inválido.');
  else data.batch_id = batchId || null;

  const wasteDate = b.waste_date ? String(b.waste_date) : hojeISO();
  if (!validaData(wasteDate)) errors.push('Data da perda inválida.');
  else if (wasteDate > hojeISO()) errors.push('A data da perda não pode ser futura.');
  else data.waste_date = wasteDate;

  const notes = String(b.notes || '').trim();
  if (notes.length > 500) errors.push('Observações com no máximo 500 caracteres.');
  else data.notes = notes || null;

  if (errors.length) return next(new ApiError(400, 'Corrija os campos do desperdício.', errors));
  req.wasteData = data;
  next();
}

module.exports = { validateCreate, MOTIVOS, MOTIVO_LABELS };
