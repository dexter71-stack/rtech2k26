// Validação de fornecedores no backend.
const { ApiError } = require('../../utils/errors');

const STATUS = ['ativo', 'inativo'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function limpar(v, max) {
  const s = String(v == null ? '' : v).trim();
  return s.length > max ? s.slice(0, max) : s;
}

function validate(body, { partial = false } = {}) {
  const errors = [];
  const data = {};
  const b = body || {};

  if (b.name !== undefined || !partial) {
    const name = limpar(b.name, 120);
    if (name.length < 2) errors.push('Informe o nome do fornecedor (mínimo 2 caracteres).');
    else data.name = name;
  }

  const textos = [
    ['legal_name', 'Razão social', 160],
    ['contact_name', 'Contato', 120],
    ['phone', 'Telefone', 30],
    ['address', 'Endereço', 255],
    ['notes', 'Observações', 500],
  ];
  for (const [campo, rotulo, max] of textos) {
    if (b[campo] !== undefined) {
      const v = limpar(b[campo], max);
      if (String(b[campo] || '').trim().length > max) errors.push(`${rotulo} com no máximo ${max} caracteres.`);
      else data[campo] = v || null;
    }
  }

  if (b.document !== undefined) {
    const doc = limpar(b.document, 30).replace(/[^\dA-Za-z]/g, '');
    if (doc && doc.length < 11) errors.push('CNPJ/CPF inválido (mínimo 11 dígitos).');
    else if (doc && doc.length > 20) errors.push('Documento com no máximo 20 caracteres.');
    else data.document = doc || null;
  }

  if (b.email !== undefined) {
    const email = limpar(b.email, 160).toLowerCase();
    if (email && !EMAIL_RE.test(email)) errors.push('E-mail inválido.');
    else data.email = email || null;
  }

  if (b.status !== undefined) {
    if (!STATUS.includes(b.status)) errors.push('Situação inválida (use ativo ou inativo).');
    else data.status = b.status;
  }

  if (errors.length) throw new ApiError(400, 'Corrija os campos destacados.', errors);
  return data;
}

const validateCreate = (req, res, next) => {
  try {
    req.fornecedorData = validate(req.body, { partial: false });
    if (!req.fornecedorData.status) req.fornecedorData.status = 'ativo';
    next();
  } catch (err) { next(err); }
};

const validateUpdate = (req, res, next) => {
  try {
    req.fornecedorData = validate(req.body, { partial: true });
    next();
  } catch (err) { next(err); }
};

module.exports = { validateCreate, validateUpdate };
