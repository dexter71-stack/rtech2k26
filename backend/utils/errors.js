// Erros de API e utilitários assíncronos compartilhados.
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const badRequest = (message, details) => new ApiError(400, message, details);
const unauthorized = (message = 'Sessão expirada. Faça login novamente.') => new ApiError(401, message);
const forbidden = (message = 'Você não tem permissão para esta ação.') => new ApiError(403, message);
const notFound = (message = 'Registro não encontrado.') => new ApiError(404, message);
const conflict = (message, details) => new ApiError(409, message, details);

// Empacota handlers async e direciona rejeições ao middleware de erros.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { ApiError, badRequest, unauthorized, forbidden, notFound, conflict, asyncHandler };
