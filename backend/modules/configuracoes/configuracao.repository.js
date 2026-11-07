// Repositório dos parâmetros do sistema (chave/valor).
const { pool } = require('../../config/db');

const PADROES = {
  establishment_name: 'Galeto São Luís',
  establishment_address: '',
  establishment_phone: '',
  alert_days: 7,
};

const normalizar = (mapa) => ({
  establishment_name: mapa.establishment_name || PADROES.establishment_name,
  establishment_address: mapa.establishment_address || '',
  establishment_phone: mapa.establishment_phone || '',
  alertDays: Math.min(90, Math.max(1, Number(mapa.alert_days) || PADROES.alert_days)),
});

async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch (e) { /* conexão interrompida */ }
    throw err;
  } finally {
    conn.release();
  }
}

class ConfiguracaoRepository {
  async obter() {
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM settings');
    const mapa = {};
    for (const row of rows) mapa[row.setting_key] = row.setting_value;
    return normalizar(mapa);
  }

  // Grava os quatro parâmetros na mesma transação.
  async salvar(data, userId) {
    await withTransaction(async (conn) => {
      const valores = {
        establishment_name: data.establishment_name,
        establishment_address: data.establishment_address || '',
        establishment_phone: data.establishment_phone || '',
        alert_days: String(data.alert_days),
      };
      for (const [key, value] of Object.entries(valores)) {
        await conn.query(
          `INSERT INTO settings (setting_key, setting_value, updated_by)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
          [key, value, userId]
        );
      }
    });
  }
}

module.exports = new ConfiguracaoRepository();
