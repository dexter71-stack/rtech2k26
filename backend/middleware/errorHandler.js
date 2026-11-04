// Tratamento centralizado de erros: mensagens de API já conhecidas são
// repassadas; falhas de infraestrutura viram 500 sem expor detalhes.
const { ApiError } = require('../utils/errors');

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { message: err.message, details: err.details } });
  }

  // Erros comuns do driver MySQL/MariaDB traduzidos para o usuário.
  if (err && err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: { message: 'Já existe um registro com este mesmo valor (duplicado).' } });
  }
  if (err && err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: { message: 'Registro relacionado não encontrado na base de dados.' } });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Formato de dados inválido na requisição.' } });
  }

  console.error('[erro] Não tratado:', err);
  return res.status(500).json({ error: { message: 'Erro interno do sistema. Tente novamente em instantes.' } });
}

function notFoundHandler(req, res) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: { message: 'Rota de API não encontrada.' } });
  }
  return res.status(404).json({ error: { message: 'Página não encontrada.' } });
}

module.exports = { errorHandler, notFoundHandler };
