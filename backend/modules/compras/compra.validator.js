// Validação de compras no backend (pedido, itens e recebimento).
const { ApiError } = require('../../utils/errors');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ITENS = 50;

function dataValida(v) {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseId(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseQty(v) {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= 999999 ? n : null;
}

function parseCost(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 999999.9999 ? n : null;
}

function validateItens(raw, orderDate, errors) {
  if (!Array.isArray(raw) || !raw.length) {
    errors.push('Inclua pelo menos um item na compra.');
    return [];
  }
  if (raw.length > MAX_ITENS) {
    errors.push(`A compra pode ter no máximo ${MAX_ITENS} itens.`);
    return [];
  }
  const itens = [];
  raw.forEach((item, idx) => {
    const n = idx + 1;
    const b = item || {};
    const productId = parseId(b.product_id);
    if (!productId) errors.push(`Item ${n}: selecione o produto.`);
    const quantity = parseQty(b.quantity);
    if (quantity === null) errors.push(`Item ${n}: quantidade inválida (maior que zero).`);
    const unitCost = parseCost(b.unit_cost);
    if (unitCost === null) errors.push(`Item ${n}: custo unitário inválido.`);
    const expires = b.expires_date;
    if (!dataValida(expires)) errors.push(`Item ${n}: informe a validade do lote.`);
    else if (orderDate && expires < orderDate) errors.push(`Item ${n}: a validade não pode ser anterior à data do pedido.`);
    const code = String(b.batch_code || '').trim();
    if (code.length > 60) errors.push(`Item ${n}: código do lote com no máximo 60 caracteres.`);
    if (productId && quantity !== null && unitCost !== null && dataValida(expires)) {
      itens.push({ product_id: productId, quantity, unit_cost: unitCost, expires_date: expires, batch_code: code || null });
    }
  });
  return itens;
}

function validateCreate(req, res, next) {
  try {
    const b = req.body || {};
    const errors = [];
    const data = {};

    data.supplier_id = parseId(b.supplier_id);
    if (!data.supplier_id) errors.push('Selecione o fornecedor.');

    data.order_date = dataValida(b.order_date) ? b.order_date : hojeISO();

    if (b.expected_date !== undefined && b.expected_date !== '') {
      if (!dataValida(b.expected_date)) errors.push('Data prevista de entrega inválida.');
      else if (b.expected_date < data.order_date) errors.push('A entrega prevista não pode ser anterior à data do pedido.');
      else data.expected_date = b.expected_date;
    }

    const invoice = String(b.invoice_number || '').trim();
    if (invoice.length > 60) errors.push('Nota fiscal com no máximo 60 caracteres.');
    else data.invoice_number = invoice || null;

    const notes = String(b.notes || '').trim();
    if (notes.length > 500) errors.push('Observações com no máximo 500 caracteres.');
    else data.notes = notes || null;

    data.items = validateItens(b.items, data.order_date, errors);

    if (errors.length) throw new ApiError(400, 'Corrija os campos destacados.', errors);
    req.compraData = data;
    next();
  } catch (err) { next(err); }
}

function validateUpdate(req, res, next) {
  try {
    const b = req.body || {};
    const errors = [];
    const data = {};

    if (b.supplier_id !== undefined) {
      const id = parseId(b.supplier_id);
      if (!id) errors.push('Selecione o fornecedor.');
      else data.supplier_id = id;
    }
    if (b.order_date !== undefined) {
      if (!dataValida(b.order_date)) errors.push('Data do pedido inválida.');
      else data.order_date = b.order_date;
    }
    if (b.expected_date !== undefined) {
      if (b.expected_date === '' || b.expected_date === null) data.expected_date = null;
      else if (!dataValida(b.expected_date)) errors.push('Data prevista de entrega inválida.');
      else data.expected_date = b.expected_date;
    }
    if (b.invoice_number !== undefined) {
      const v = String(b.invoice_number || '').trim();
      if (v.length > 60) errors.push('Nota fiscal com no máximo 60 caracteres.');
      else data.invoice_number = v || null;
    }
    if (b.notes !== undefined) {
      const v = String(b.notes || '').trim();
      if (v.length > 500) errors.push('Observações com no máximo 500 caracteres.');
      else data.notes = v || null;
    }
    if (b.items !== undefined) {
      data.items = validateItens(b.items, data.order_date || null, errors);
    }

    if (errors.length) throw new ApiError(400, 'Corrija os campos destacados.', errors);
    req.compraData = data;
    next();
  } catch (err) { next(err); }
}

function validateReceive(req, res, next) {
  try {
    const b = req.body || {};
    const errors = [];
    const data = {};
    data.received_date = dataValida(b.received_date) ? b.received_date : hojeISO();
    if (b.received_date !== undefined && !dataValida(b.received_date)) {
      errors.push('Data de recebimento inválida.');
    }
    if (b.invoice_number !== undefined) {
      const v = String(b.invoice_number || '').trim();
      if (v.length > 60) errors.push('Nota fiscal com no máximo 60 caracteres.');
      else data.invoice_number = v || null;
    }
    if (errors.length) throw new ApiError(400, 'Corrija os campos destacados.', errors);
    req.recebimentoData = data;
    next();
  } catch (err) { next(err); }
}

module.exports = { validateCreate, validateUpdate, validateReceive, dataValida, parseId };
