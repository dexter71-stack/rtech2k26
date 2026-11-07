// Repositório de auditoria.
const { pool } = require('../../config/db');

async function insert({ userId, action, module, recordId, description, ip }) {
  await pool.query(
    `INSERT INTO audit_log (user_id, action, module, record_id, description, ip)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId || null, action, module || null, recordId || null, description || null, ip || null]
  );
}

// Listagem paginada com filtros (somente administradores, controlado na rota).
async function list({ page, pageSize, moduleName, action, userName, dateFrom, dateTo }) {
  const where = [];
  const params = [];

  if (moduleName) { where.push('a.module LIKE ?'); params.push(`%${moduleName}%`); }
  if (action) { where.push('a.action LIKE ?'); params.push(`%${action}%`); }
  if (userName) {
    where.push('(u.name LIKE ? OR u.email LIKE ?)');
    params.push(`%${userName}%`, `%${userName}%`);
  }
  if (dateFrom) { where.push('a.created_at >= ?'); params.push(`${dateFrom} 00:00:00`); }
  if (dateTo) { where.push('a.created_at <= ?'); params.push(`${dateTo} 23:59:59`); }
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS count FROM audit_log a LEFT JOIN users u ON u.id = a.user_id${whereSql}`,
    params
  );
  const total = countRows[0].count;

  const [rows] = await pool.query(
    `SELECT a.id, a.action, a.module, a.record_id, a.description, a.ip, a.created_at,
            u.name AS user_name
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       ${whereSql}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );

  return { total, page, pageSize, rows };
}

module.exports = { insert, list };
