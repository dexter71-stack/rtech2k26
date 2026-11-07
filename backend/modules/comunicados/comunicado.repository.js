// Repositório dos comunicados internos (mural + leituras).
const { pool } = require('../../config/db');

const SELECT_BASE = `
  SELECT a.id, a.title, a.message, a.priority, a.status, a.created_at, a.updated_at, a.archived_at,
         u.name AS author_name,
         (SELECT COUNT(*) FROM announcement_reads r WHERE r.announcement_id = a.id) AS read_count,
         (SELECT COUNT(*) FROM users x WHERE x.status = 'ativo') AS active_users,
         EXISTS (SELECT 1 FROM announcement_reads r2
                  WHERE r2.announcement_id = a.id AND r2.user_id = ?) AS read_by_me
    FROM announcements a
    LEFT JOIN users u ON u.id = a.user_id`;

class ComunicadoRepository {
  async list({ status, priority, search, page, pageSize, userId }) {
    const where = [];
    const params = [userId];

    if (status) { where.push('a.status = ?'); params.push(status); }
    if (priority) { where.push('a.priority = ?'); params.push(priority); }
    if (search) {
      where.push('(a.title LIKE ? OR a.message LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS count FROM announcements a${whereSql}`,
      where.length ? params.slice(1) : []
    );

    const [rows] = await pool.query(
      `${SELECT_BASE}${whereSql}
        ORDER BY FIELD(a.priority, 'alta', 'media', 'baixa'), a.created_at DESC, a.id DESC
        LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    return { total: countRows[0].count, page, pageSize, rows };
  }

  // Números do topo do mural: ativos, não lidos pelo usuário e de prioridade alta.
  async resumo(userId) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS ativos,
              COALESCE(SUM(NOT EXISTS (SELECT 1 FROM announcement_reads r
                                        WHERE r.announcement_id = a.id AND r.user_id = ?)), 0) AS nao_lidos,
              COALESCE(SUM(a.priority = 'alta'), 0) AS alta
         FROM announcements a
        WHERE a.status = 'ativo'`,
      [userId]
    );
    return rows[0];
  }

  async findById(id, userId) {
    const [rows] = await pool.query(`${SELECT_BASE} WHERE a.id = ?`, [userId, id]);
    return rows[0] || null;
  }

  async create({ title, message, priority, userId }) {
    const [result] = await pool.query(
      `INSERT INTO announcements (title, message, priority, user_id) VALUES (?, ?, ?, ?)`,
      [title, message, priority, userId]
    );
    return result.insertId;
  }

  async marcarLido(id, userId) {
    const [result] = await pool.query(
      'INSERT IGNORE INTO announcement_reads (announcement_id, user_id) VALUES (?, ?)',
      [id, userId]
    );
    return result.affectedRows > 0;
  }

  // Arquivar/reabrir: o histórico de leitura é preservado.
  async alterarStatus(id, status) {
    const [result] = await pool.query(
      `UPDATE announcements
          SET status = ?, archived_at = ${status === 'arquivado' ? 'NOW()' : 'NULL'}, updated_at = NOW()
        WHERE id = ?`,
      [status, id]
    );
    return result.affectedRows > 0;
  }

  async leituras(id) {
    const [rows] = await pool.query(
      `SELECT u.name AS user_name, u.role, r.read_at
         FROM announcement_reads r
         JOIN users u ON u.id = r.user_id
        WHERE r.announcement_id = ?
        ORDER BY r.read_at DESC`,
      [id]
    );
    return rows;
  }
}

module.exports = new ComunicadoRepository();
