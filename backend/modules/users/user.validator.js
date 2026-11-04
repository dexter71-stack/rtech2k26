// Validação de dados de funcionário no backend (padronizada para os 3 perfis).
const { ApiError } = require('../../utils/errors');

const ROLES = ['admin', 'gerente', 'funcionario'];
const STATUS = ['ativo', 'inativo'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function baseValidate(user, { requirePassword }) {
  const errors = [];
  const data = {};

  const name = (user.name || '').trim();
  if (name.length < 3 || name.length > 120) errors.push('Informe o nome completo (3 a 120 caracteres).');
  else data.name = name;

  const email = (user.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 160) errors.push('Informe um e-mail válido.');
  else data.email = email;

  const username = (user.username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    errors.push('Usuário deve ter 3 a 40 caracteres, apenas letras minúsculas, números, ponto, hífen ou underline.');
  } else data.username = username;

  const position = (user.position || '').trim();
  if (position && position.length > 80) errors.push('Cargo com no máximo 80 caracteres.');
  else if (!position) errors.push('Informe o cargo do funcionário.');
  else data.position = position;

  if (!ROLES.includes(user.role)) errors.push('Perfil de acesso inválido (use administrador, gerente ou funcionário).');
  else data.role = user.role;

  if (user.status !== undefined) {
    if (!STATUS.includes(user.status)) errors.push('Situação inválida (use ativo ou inativo).');
    else data.status = user.status;
  }

  const password = user.password;
  if (requirePassword || password !== undefined) {
    if (typeof password !== 'string' || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      errors.push('Senha deve ter no mínimo 8 caracteres, com letras e números.');
    } else {
      data.password = password;
    }
  }

  return { valid: errors.length === 0, errors, data };
}

function validateCreate(req, res, next) {
  const { valid, errors, data } = baseValidate(req.body || {}, { requirePassword: true });
  if (!valid) return next(new ApiError(400, 'Corrija os campos do formulário.', errors));
  req.userData = data;
  next();
}

function validateUpdate(req, res, next) {
  const { valid, errors, data } = baseValidate(req.body || {}, { requirePassword: false });
  if (!valid) return next(new ApiError(400, 'Corrija os campos do formulário.', errors));
  req.userData = data;
  next();
}

module.exports = { validateCreate, validateUpdate, ROLES, STATUS };
