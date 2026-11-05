// Validação de dados do catálogo (categorias e unidades) no backend.
const { ApiError } = require('../../utils/errors');

function validateCategoriaBody(body) {
  const errors = [];
  const data = {};

  const name = (body.name || '').trim();
  if (name.length < 3 || name.length > 80) errors.push('Informe o nome da categoria (3 a 80 caracteres).');
  else data.name = name;

  const description = (body.description || '').trim();
  if (description.length > 255) errors.push('Descrição com no máximo 255 caracteres.');
  else data.description = description || null;

  return { valid: errors.length === 0, errors, data };
}

function validateUnidadeBody(body) {
  const errors = [];
  const data = {};

  const name = (body.name || '').trim();
  if (name.length < 3 || name.length > 80) errors.push('Informe o nome da unidade (3 a 80 caracteres).');
  else data.name = name;

  const symbol = (body.symbol || '').trim();
  if (symbol.length < 1 || symbol.length > 20) errors.push('Informe o símbolo da unidade (até 20 caracteres), ex.: kg, un, L.');
  else data.symbol = symbol;

  return { valid: errors.length === 0, errors, data };
}

function validateCategoria(req, res, next) {
  const { valid, errors, data } = validateCategoriaBody(req.body || {});
  if (!valid) return next(new ApiError(400, 'Corrija os campos do formulário.', errors));
  req.catalogoData = data;
  next();
}

function validateUnidade(req, res, next) {
  const { valid, errors, data } = validateUnidadeBody(req.body || {});
  if (!valid) return next(new ApiError(400, 'Corrija os campos do formulário.', errors));
  req.catalogoData = data;
  next();
}

module.exports = { validateCategoria, validateUnidade };
