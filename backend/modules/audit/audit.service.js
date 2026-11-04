// Regras de negocio de auditoria.
const auditRepository = require('./audit.repository');

// Não falha a operação principal caso a auditoria não permita registro.
async function log({ userId, action, module, recordId, description, ip }) {
  try {
    await auditRepository.insert({ userId, action, module, recordId, description, ip });
  } catch (err) {
    console.error('[auditoria] Falha ao registrar:', err.message);
  }
}

async function list(filters) {
  return auditRepository.list(filters);
}

module.exports = { log, list };
