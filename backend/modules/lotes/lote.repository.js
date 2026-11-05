// Repositório de lotes (listagem/validade). Estoque criado via movimentações.
const { pool } = require('../../config/db');

const COLS = `
  b.id, b.product_id, b.code, b.received_qty, b.remaining_qty,
  b.received_date, b.manufactured_date, b.expires_date,
  b.supplier_id, b.supplier_name, b.unit_cost, b.status, b.created_at,
  p.name AS product_name, p.min_stock, u.symbol AS unit_symbol,
  c.name AS category_name,
  us.name AS created_by_name,
  DATEDIFF(b.expires_date, CURDATE()) AS dias_para_vencer`;

class LoteRepository {
  // Limpeza de status: lote ativo com saldo e já vencido passa a "vencido".
  async marcarVencidos() {
    await pool.query(
      `UPDATE batches SET status = 'vencido'
        WHERE status = 'ativo' AND remaining_qty > 0 AND expires_date < CURDATE()`
    );
  }

  async list({ productId, status, search, venceEmDias, apenasComSaldo, page, pageSize }) {
    const where = [];
    const params = [];

    if (productId) { where.push('b.product_id = ?'); params.push(productId); }
    if (status) { where.push('b.status = ?'); params.push(status); }
    if (apenasComSaldo) where.push('b.remaining_qty > 0');
    if (search) {
      where.push('(p.name LIKE ? OR b.code LIKE ? OR b.supplier_name LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (venceEmDias !== undefined) {
      where.push("b.status <> 'esgotado' AND b.status <> 'cancelado' AND b.remaining_qty > 0");
      where.push('b.expires_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)');
      params.push(venceEmDias);
    }
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS count FROM batches b JOIN products p ON p.id = b.product_id${whereSql}`,
      params
    );
    const total = countRows[0].count;

    const [rows] = await pool.query(
      `SELECT ${COLS}
         FROM batches b
         JOIN products p ON p.id = b.product_id
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN units u ON u.id = p.unit_id
         LEFT JOIN users us ON us.id = b.created_by
        ${whereSql}
        ORDER BY ${venceEmDias !== undefined ? 'b.expires_date ASC, p.name ASC' : 'b.expires_date ASC, p.name ASC'}
        LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    return { total, page, pageSize, rows };
  }
}

module.exports = new LoteRepository();
