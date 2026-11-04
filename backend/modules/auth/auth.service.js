// Regras de negócio de autenticação (login, sessão, logout).
const bcrypt = require('bcryptjs');
const authRepository = require('./auth.repository');
const auditService = require('../audit/audit.service');
const { signToken } = require('../../utils/jwt');
const { unauthorized } = require('../../utils/errors');

const COOKIE_NAME = process.env.COOKIE_NAME || 'gg_token';

async function login({ identifier, password }, ip) {
  if (!identifier || !password) throw unauthorized('Informe usuário e senha.');

  const user = await authRepository.findByEmailOrUsername(String(identifier).trim());
  if (!user) throw unauthorized('E-mail/usuário ou senha inválidos.');

  const match = await bcrypt.compare(String(password), user.password_hash);
  if (!match) throw unauthorized('E-mail/usuário ou senha inválidos.');

  if (user.status !== 'ativo') throw unauthorized('Conta desativada. Fale com um administrador.');

  await auditService.log({
    userId: user.id,
    action: 'LOGIN',
    module: 'Auth',
    description: `Entrada no sistema por ${user.name}`,
    ip,
  });

  const payload = {
    id: user.id,
    name: user.name,
    role: user.role,
    position: user.position,
  };
  const token = signToken(payload);

  return { token, cookieName: COOKIE_NAME, payload };
}

async function logout(user, ip) {
  if (user) {
    await auditService.log({
      userId: user.id,
      action: 'LOGOUT',
      module: 'Auth',
      description: `Saída do sistema por ${user.name}`,
      ip,
    });
  }
  return { cookieName: COOKIE_NAME };
}

module.exports = { login, logout };
