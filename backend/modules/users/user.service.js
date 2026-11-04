// Regras de negócio de funcionários.
const bcrypt = require('bcryptjs');
const userRepository = require('./user.repository');
const auditService = require('../audit/audit.service');
const { badRequest, notFound, conflict } = require('../../utils/errors');

async function list(filters) {
  return userRepository.list(filters);
}

async function create(data, actor) {
  const duplicate = await userRepository.existsDuplicate(data.email, data.username);
  if (duplicate) {
    throw conflict(duplicate.email === data.email ? 'Este e-mail já está cadastrado.' : 'Este nome de usuário já está em uso.');
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const created = await userRepository.create({
    name: data.name,
    email: data.email,
    username: data.username,
    position: data.position,
    role: data.role,
    status: data.status || 'ativo',
    passwordHash,
  });

  await auditService.log({
    userId: actor.id,
    action: 'CRIAR',
    module: 'Funcionários',
    recordId: String(created.id),
    description: `Cadastro do funcionário ${created.name} (${created.role})`,
    ip: actor.ip,
  });
  return created;
}

async function update(id, data, actor) {
  const target = await userRepository.findById(id);
  if (!target) throw notFound('Funcionário não encontrado.');

  const duplicate = await userRepository.existsDuplicate(data.email, data.username, id);
  if (duplicate) {
    throw conflict(duplicate.email === data.email ? 'Este e-mail já está em uso por outro funcionário.' : 'Este nome de usuário já está em uso.');
  }

  const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined;
  const changedRole = data.role !== undefined && data.role !== target.role;
  const changedStatus = data.status !== undefined && data.status !== target.status;

  // Proteção do último administrador ativo do sistema.
  if ((changedRole && target.role === 'admin') || (changedStatus && target.status === 'ativo')) {
    const remainingAdmins = await userRepository.countActiveAdmins(id);
    if (target.role === 'admin' && ((changedRole && data.role !== 'admin'))) {
      if (remainingAdmins === 0) throw badRequest('O sistema precisa de ao menos um administrador ativo.');
    }
    if (target.status === 'ativo' && data.status === 'inativo' && target.role === 'admin') {
      if (remainingAdmins === 0) throw badRequest('O sistema precisa de ao menos um administrador ativo.');
    }
  }

  const updated = await userRepository.update(id, { ...data, passwordHash });

  await auditService.log({
    userId: actor.id,
    action: 'ALTERAR',
    module: 'Funcionários',
    recordId: String(id),
    description: `Atualização de funcionário ${updated.name}`,
    ip: actor.ip,
  });
  return updated;
}

async function setStatus(id, status, actor) {
  const target = await userRepository.findById(id);
  if (!target) throw notFound('Funcionário não encontrado.');

  if (target.status === status) return target;
  if (target.role === 'admin' && status === 'inativo') {
    const remainingAdmins = await userRepository.countActiveAdmins(id);
    if (remainingAdmins === 0) throw badRequest('O sistema precisa de ao menos um administrador ativo.');
  }
  if (target.id === actor.id && status === 'inativo') throw badRequest('Você não pode desativar a própria conta.');

  const updated = await userRepository.setStatus(id, status);
  await auditService.log({
    userId: actor.id,
    action: 'SITUAÇÃO',
    module: 'Funcionários',
    recordId: String(id),
    description: `${status === 'ativo' ? 'Ativação' : 'Desativação'} da conta de ${updated.name}`,
    ip: actor.ip,
  });
  return updated;
}

module.exports = { list, create, update, setStatus };
