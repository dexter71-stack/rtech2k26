// Repositório de autenticação: acesso direto ao banco.
const { pool } = require('../../config/db');

// Login por usuário ou e-mail.
async function findByEmailOrUsername(identifier) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE (email = ? OR username = ?) LIMIT 1',
    [identifier, identifier]
  );
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query('SELECT id, name, email, username, position, role, status FROM users WHERE id = ?', [id]);
  return rows[0] || null;
}

module.exports = { findByEmailOrUsername, findById };
