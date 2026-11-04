// Autenticação das rotas privadas e verificação de perfil (RBAC).
// As permissões são sempre validadas aqui, nunca só no frontend.
const { pool } = require('../config/db');
const { verifyToken } = require('../utils/jwt');
const { unauthorized, forbidden } = require('../utils/errors');

const ROLE_LABELS = { admin: 'Administrador', gerente: 'Gerente', funcionario: 'Funcionário' };

// Carrega o usuário logado a partir do cookie de sessão.
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies && req.cookies[process.env.COOKIE_NAME || 'gg_token'];
    if (!token) throw unauthorized();

    let payload;
    try {
      payload = verifyToken(token);
    } catch (e) {
      throw unauthorized();
    }

    // Recarrega o usuário para o papel e situação estarem sempre atuais.
    const [rows] = await pool.query(
      'SELECT id, name, email, username, position, role, status FROM users WHERE id = ?',
      [payload.id]
    );
    const user = rows[0];
    if (!user) throw unauthorized();
    if (user.status !== 'ativo') throw unauthorized('Conta desativada. Fale com um administrador.');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Restringe a rota aos papéis informados.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(forbidden());
    if (!roles.includes(req.user.role)) {
      return next(forbidden('Você não tem permissão para esta ação.'));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, ROLE_LABELS };
