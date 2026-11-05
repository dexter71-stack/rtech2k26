// Repositório de produtos. O estoque atual é sempre calculado a partir
// dos lotes ativos (fonte única de verdade), nunca armazenado no produto.
const { pool } = require('../../config/db');

const STOCK_SUBQUERY = `COALESCE((
  SELECT SUM(b.remaining_qty) FROM batches b
   WHERE b.product_id = p.id AND b.status = 'ativo'
), 0)`;

const SELECT_BASE = `
  SELECT p.id, p.name, p.category_id, p.unit_id, p.description, p.min_stock, p.max_stock,
         p.reference_cost, p.status, p.notes, p.created_at, p.updated_at,
         c.name AS category_name, u.symbol AS unit_symbol,
         ${STOCK_SUBQUERY} AS current_stock
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN units u ON u.id = p.unit_id`;

class ProdutoRepository {
  async list({ search, categoryId, status, lowOnly, page, pageSize }) {
    const where = [];
    const params = [];

    if (search) {
      where.push('(p.name LIKE ? OR p.description LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s);
    }
    if (categoryId) { where.push('p.category_id = ?'); params.push(categoryId); }
    if (status) { where.push('p.status = ?'); params.push(status); }
    if (lowOnly) {
      where.push(`p.status = 'ativo' AND p.min_stock > 0 AND ${STOCK_SUBQUERY} > 0 AND ${STOCK_SUBQUERY} <= p.min_stock`);
    }
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS count FROM products p${whereSql}`, params
    );
    const total = countRows[0].count;

    const [rows] = await pool.query(
      `${SELECT_BASE}${whereSql}
        ORDER BY p.name ASC
        LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    return { total, page, pageSize, rows };
  }

  async findById(id) {
    const [rows] = await pool.query(`${SELECT_BASE} WHERE p.id = ?`, [id]);
    return rows[0] || null;
  }

  async create(data) {
    const [result] = await pool.query(
      `INSERT INTO products
         (name, category_id, unit_id, description, min_stock, max_stock, reference_cost, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name, data.category_id, data.unit_id, data.description,
        data.min_stock, data.max_stock, data.reference_cost, data.status, data.notes,
      ]
    );
    return this.findById(result.insertId);
  }

  async update(id, data) {
    const fields = [];
    const params = [];
    const keep = ['name', 'category_id', 'unit_id', 'description', 'min_stock', 'max_stock', 'reference_cost', 'status', 'notes'];
    for (const key of keep) {
      if (data[key] !== undefined) { fields.push(`${key} = ?`); params.push(data[key]); }
    }
    if (!fields.length) return this.findById(id);
    params.push(id);
    await pool.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }

  async setStatus(id, status) {
    await pool.query('UPDATE products SET status = ? WHERE id = ?', [status, id]);
    return this.findById(id);
  }
}

module.exports = new ProdutoRepository();
