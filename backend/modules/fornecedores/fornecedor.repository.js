// Repositório de fornecedores com estatísticas de compras e lotes.
const { pool } = require('../../config/db');

const SELECT_BASE = `
  SELECT s.id, s.name, s.legal_name, s.document, s.contact_name, s.phone, s.email,
         s.address, s.notes, s.status, s.created_at, s.updated_at,
         (SELECT COUNT(*) FROM purchases p WHERE p.supplier_id = s.id) AS purchase_count,
         COALESCE((SELECT SUM(p.total_amount) FROM purchases p
                    WHERE p.supplier_id = s.id AND p.status = 'recebida'), 0) AS purchased_total
    FROM suppliers s`;

class FornecedorRepository {
  async list({ search, status, page, pageSize }) {
    const where = [];
    const params = [];
    if (search) {
      where.push('(s.name LIKE ? OR s.legal_name LIKE ? OR s.document LIKE ? OR s.contact_name LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (status) { where.push('s.status = ?'); params.push(status); }
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.query(`SELECT COUNT(*) AS count FROM suppliers s${whereSql}`, params);
    const [rows] = await pool.query(
      `${SELECT_BASE}${whereSql} ORDER BY s.name ASC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    return { total: countRows[0].count, page, pageSize, rows };
  }

  async findById(id) {
    const [rows] = await pool.query(`${SELECT_BASE} WHERE s.id = ?`, [id]);
    return rows[0] || null;
  }

  async findByDocument(document) {
    const [rows] = await pool.query('SELECT id FROM suppliers WHERE document = ?', [document]);
    return rows[0] || null;
  }

  async countPurchases(id) {
    const [rows] = await pool.query('SELECT COUNT(*) AS count FROM purchases WHERE supplier_id = ?', [id]);
    return rows[0].count;
  }

  async create(data) {
    const [result] = await pool.query(
      `INSERT INTO suppliers
         (name, legal_name, document, contact_name, phone, email, address, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.name, data.legal_name, data.document, data.contact_name,
       data.phone, data.email, data.address, data.notes, data.status]
    );
    return this.findById(result.insertId);
  }

  async update(id, data) {
    const fields = [];
    const params = [];
    for (const key of ['name', 'legal_name', 'document', 'contact_name', 'phone', 'email', 'address', 'notes', 'status']) {
      if (data[key] !== undefined) { fields.push(`${key} = ?`); params.push(data[key]); }
    }
    if (!fields.length) return this.findById(id);
    params.push(id);
    await pool.query(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }

  async remove(id) {
    const [result] = await pool.query('DELETE FROM suppliers WHERE id = ?', [id]);
    return result.affectedRows;
  }
}

module.exports = new FornecedorRepository();
