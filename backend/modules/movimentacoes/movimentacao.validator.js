// Validação de movimentações no backend.
const { ApiError } = require('../../utils/errors');

// Entradas criam lote; saídas consomem estoque; ajuste registra correção.
const TIPOS_ENTRADA = ['entrada', 'entrada_compra', 'entrada_ajuste'];
const TIPOS_SAIDA = ['saida', 'saida_desperdicio', 'saida_ajuste'];
const TIPOS = [...TIPOS_ENTRADA, ...TIPOS_SAIDA, 'estorno'];
const LABELS = {
  entrada: 'Entrada',
  entrada_compra: 'Entrada (compra)',
  entrada_ajuste: 'Entrada (ajuste)',
  saida: 'Saída (uso)',
  saida_desperdicio: 'Saída (desperdício)',
  saida_ajuste: 'Saída (ajuste)',
  estorno: 'Estorno',
};

const hojeISO = () => new Date().toISOString().slice(0, 10);
const validaData = (v) => String(v || '').match(/^\d{4}-\d{2}-\d{2}$/) && !Number.isNaN(new Date(`${v}T00:00:00`).getTime());

function parseQty(v) {
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n > 999999) return NaN;
  return n;
}

function validateCreate(req, res, next) {
  const errors = [];
  const data = {};
  const b = req.body || {};

  if (!TIPOS.includes(b.type) || b.type === 'estorno') {
    errors.push('Tipo de movimentação inválido (estornos são feitos pela ação própria de estornar).');
  } else {
    data.type = b.type;
  }

  const productId = Number(b.product_id);
  if (!Number.isInteger(productId) || productId <= 0) errors.push('Selecione um produto.');
  else data.product_id = productId;

  const qty = parseQty(b.quantity);
  if (Number.isNaN(qty)) errors.push('Informe uma quantidade maior que zero.');
  else data.quantity = qty;

  const notes = (b.notes || '').trim();
  if (notes.length > 500) errors.push('Observações com no máximo 500 caracteres.');
  else data.notes = notes || null;

  if (data.type && TIPOS_ENTRADA.includes(data.type)) {
    // Entrada = criação de lote. Campos de validade são obrigatórios.
    const received_date = (b.received_date || '') === '' ? hojeISO() : b.received_date;
    if (!validaData(received_date)) errors.push('Data de recebimento inválida.');
    else data.received_date = received_date;

    if (!validaData(b.expires_date)) errors.push('Informe a data de validade do lote.');
    else data.expires_date = b.expires_date;

    if (b.manufactured_date && !validaData(b.manufactured_date)) errors.push('Data de fabricação inválida.');
    else if (b.manufactured_date && data.received_date && b.manufactured_date > data.received_date) {
      errors.push('Data de fabricação não pode ser posterior ao recebimento.');
    } else data.manufactured_date = b.manufactured_date || null;

    if (data.received_date && data.expires_date && data.expires_date < data.received_date) {
      errors.push('A validade não pode ser anterior à data de recebimento.');
    }

    const code = (b.code || '').trim();
    if (code.length > 60) errors.push('Código do lote com no máximo 60 caracteres.');
    else data.code = code || null;

    if (data.type === 'entrada_compra') {
      const fornecedor = (b.supplier_name || '').trim();
      if (fornecedor.length > 160) errors.push('Nome do fornecedor com no máximo 160 caracteres.');
      else data.supplier_name = fornecedor || null;
      const custo = b.unit_cost === '' || b.unit_cost === undefined ? 0 : Number(String(b.unit_cost).replace(',', '.'));
      if (!Number.isFinite(custo) || custo < 0 || custo > 999999.9999) errors.push('Custo unitário inválido.');
      else data.unit_cost = custo;
    } else {
      data.supplier_name = null;
      data.unit_cost = 0;
    }
  }

  if (data.type && TIPOS_SAIDA.includes(data.type)) {
    // Saída: opcionalmente um lote específico; senão o sistema escolhe em FEFO.
    const batchId = Number(b.batch_id);
    if (b.batch_id && (!Number.isInteger(batchId) || batchId <= 0)) {
      errors.push('Lote inválido.');
    } else data.batch_id = batchId || null;
  }

  if (errors.length) return next(new ApiError(400, 'Corrija os campos da movimentação.', errors));
  req.movementData = data;
  next();
}

module.exports = { validateCreate, TIPOS, TIPOS_ENTRADA, TIPOS_SAIDA, LABELS };
