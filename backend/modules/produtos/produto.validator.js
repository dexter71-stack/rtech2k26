// Validação de dados de produto no backend.
const { ApiError } = require('../../utils/errors');

const STATUS = ['ativo', 'inativo'];

function baseValidate(body, { partial = false } = {}) {
  const errors = [];
  const data = {};
  const b = body || {};

  if (b.name !== undefined || !partial) {
    const name = (b.name || '').trim();
    if (name.length < 2 || name.length > 120) errors.push('Informe o nome do produto (2 a 120 caracteres).');
    else data.name = name;
  }

  const parseId = (v) => {
    if (v === '' || v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : NaN;
  };

  if (b.category_id !== undefined || !partial) {
    const id = parseId(b.category_id);
    if (Number.isNaN(id)) errors.push('Categoria inválida.');
    else data.category_id = id;
  }

  if (b.unit_id !== undefined || !partial) {
    const id = parseId(b.unit_id);
    if (Number.isNaN(id)) errors.push('Unidade de medida inválida.');
    else data.unit_id = id;
  }

  const parseQty = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 999999999) return NaN;
    return n;
  };

  if (b.min_stock !== undefined || !partial) {
    const n = parseQty(b.min_stock);
    if (Number.isNaN(n)) errors.push('Estoque mínimo inválido (use número maior ou igual a zero).');
    else data.min_stock = n || 0;
  }

  if (b.max_stock !== undefined) {
    const n = parseQty(b.max_stock);
    if (Number.isNaN(n)) errors.push('Estoque máximo inválido (número maior ou igual a zero, ou vazio).');
    else data.max_stock = n;
  }

  if (b.reference_cost !== undefined || !partial) {
    const v = (b.reference_cost === '' || b.reference_cost === undefined) ? 0 : b.reference_cost;
    const n = Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 999999.9999) errors.push('Custo de referência inválido.');
    else data.reference_cost = n || 0;
  }

  if (b.description !== undefined) {
    const d = (b.description || '').trim();
    if (d.length > 255) errors.push('Descrição com no máximo 255 caracteres.');
    else data.description = d || null;
  }

  if (b.status !== undefined) {
    if (!STATUS.includes(b.status)) errors.push('Situação inválida (use ativo ou inativo).');
    else data.status = b.status;
  }

  if (b.notes !== undefined) {
    const n = (b.notes || '').trim();
    if (n.length > 500) errors.push('Observações com no máximo 500 caracteres.');
    else data.notes = n || null;
  }

  // Regra combinada mínimo × máximo quando ambos informados.
  if (data.min_stock !== undefined && data.max_stock != null && data.max_stock > 0 && data.max_stock < data.min_stock) {
    errors.push('O estoque máximo não pode ser menor que o mínimo.');
  }

  return { valid: errors.length === 0, errors, data };
}

function validateCreate(req, res, next) {
  const { valid, errors, data } = baseValidate(req.body || {}, { partial: false });
  if (!valid) return next(new ApiError(400, 'Corrija os campos do formulário.', errors));
  data.status = data.status || 'ativo';
  req.productData = data;
  next();
}

function validateUpdate(req, res, next) {
  const { valid, errors, data } = baseValidate(req.body || {}, { partial: true });
  if (!valid) return next(new ApiError(400, 'Corrija os campos do formulário.', errors));
  req.productData = data;
  next();
}

module.exports = { validateCreate, validateUpdate, STATUS };
