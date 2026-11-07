// Validação dos comunicados no backend.
const { ApiError } = require('../../utils/errors');

const PRIORIDADES = ['baixa', 'media', 'alta'];
const PRIORIDADE_LABELS = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };

function validateCreate(req, res, next) {
  const errors = [];
  const data = {};
  const b = req.body || {};

  const title = String(b.title || '').trim().replace(/\s+/g, ' ');
  if (title.length < 3 || title.length > 120) errors.push('O título deve ter entre 3 e 120 caracteres.');
  else data.title = title;

  const message = String(b.message || '').trim();
  if (message.length < 3) errors.push('Escreva a mensagem do comunicado.');
  else if (message.length > 4000) errors.push('A mensagem deve ter no máximo 4.000 caracteres.');
  else data.message = message;

  const priority = String(b.priority || 'media');
  if (!PRIORIDADES.includes(priority)) errors.push('Prioridade inválida.');
  else data.priority = priority;

  if (errors.length) return next(new ApiError(400, 'Corrija os campos do comunicado.', errors));
  req.comunicadoData = data;
  next();
}

module.exports = { validateCreate, PRIORIDADES, PRIORIDADE_LABELS };
