// Validação dos parâmetros do sistema.
const { ApiError } = require('../../utils/errors');

function validateUpdate(req, res, next) {
  const errors = [];
  const b = req.body || {};

  const name = String(b.establishment_name || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) errors.push('O nome do estabelecimento deve ter entre 2 e 80 caracteres.');

  const address = String(b.establishment_address || '').trim();
  if (address.length > 160) errors.push('O endereço deve ter no máximo 160 caracteres.');

  const phone = String(b.establishment_phone || '').trim();
  if (phone.length > 30) errors.push('O telefone deve ter no máximo 30 caracteres.');

  const alertDays = Number(b.alert_days);
  if (!Number.isInteger(alertDays) || alertDays < 1 || alertDays > 90) {
    errors.push('A janela de alerta de validade deve ser um número inteiro entre 1 e 90 dias.');
  }

  if (errors.length) return next(new ApiError(400, 'Corrija os parâmetros da galeteria.', errors));

  req.configuracaoData = {
    establishment_name: name,
    establishment_address: address,
    establishment_phone: phone,
    alert_days: alertDays,
  };
  next();
}

module.exports = { validateUpdate };
