// Repositório de funcionários.
const { pool } = require('../../config/db');

const PUBLIC_COLUMNS = 'id, name, email, username, position, role, status, created_at, updated_at';

class UserRepository {
  async list({ search, role, status, page, pageSize }) {
    const where = [];
    const params = [];

    if (search) {
      where.push('(name LIKE ? OR email LIKE ? OR username LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (role) { where.push('role = ?'); params.push(role); }
    if (status) { where.push('status = ?'); params.push(status); }
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.query(`SELECT COUNT(*) AS count FROM users${whereSql}`, params);
    const total = countRows[0].count;

    const [rows] = await pool.query(
      `SELECT ${PUBLIC_COLUMNS} FROM users${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    return { total, page, pageSize, rows };
  }

  async findById(id) {
    const [rows] = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`, [id]);
    return rows[0] || null;
  }

  async existsDuplicate(email, username, exceptId) {
    const [rows] = await pool.query(
      'SELECT id, email, username FROM users WHERE (email = ? OR username = ?)',
      [email, username]
    );
    return rows.find(r => r.id !== exceptId) || null;
  }

  async create({ name, email, username, position, role, status, passwordHash }) {
    const [result] = await pool.query(
      `INSERT INTO users (name, email, username, position, role, status, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, username, position, role, status, passwordHash]
    );
    return this.findById(result.insertId);
  }

  async update(id, { name, email, username, position, role, status, passwordHash }) {
    const fields = [];
    const params = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (email !== undefined) { fields.push('email = ?'); params.push(email); }
    if (username !== undefined) { fields.push('username = ?'); params.push(username); }
    if (position !== undefined) { fields.push('position = ?'); params.push(position); }
    if (role !== undefined) { fields.push('role = ?'); params.push(role); }
    if (status !== undefined) { fields.push('status = ?'); params.push(status); }
    if (passwordHash !== undefined) { fields.push('password_hash = ?'); params.push(passwordHash); }
    if (!fields.length) return this.findById(id);
    params.push(id);

    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }

  async countActiveAdmins(exceptId) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'ativo' AND id <> ?`,
      [exceptId || 0]
    );
    return rows[0].count;
  }

  async setStatus(id, status) {
    await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    return this.findById(id);
  }
}

module.exports = new UserRepository();
