// Repositório de alertas operacionais do estoque.
// Baixo estoque e vencimientos são calculados sempre a partir dos lotes ativos.
const { pool } = require('../../config/db');

const ESTOQUE = `COALESCE((SELECT SUM(b.remaining_qty) FROM batches b
   WHERE b.product_id = p.id AND b.status = 'ativo'), 0)`;

const PRODUTO_COLS = `
  p.id, p.name, p.category_id, p.unit_id, p.min_stock, p.max_stock, p.reference_cost,
  c.name AS category_name, u.symbol AS unit_symbol,
  ${ESTOQUE} AS current_stock`;

async function produtosBaixoEstoque() {
  const [rows] = await pool.query(
    `SELECT ${PRODUTO_COLS}
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN units u ON u.id = p.unit_id
      WHERE p.status = 'ativo' AND p.min_stock > 0
        AND ${ESTOQUE} > 0 AND ${ESTOQUE} <= p.min_stock
      ORDER BY ${ESTOQUE} ASC, p.name ASC`
  );
  return rows;
}

async function produtosSemEstoque() {
  const [rows] = await pool.query(
    `SELECT ${PRODUTO_COLS}
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN units u ON u.id = p.unit_id
      WHERE p.status = 'ativo' AND ${ESTOQUE} = 0
      ORDER BY p.name ASC`
  );
  return rows;
}

async function lotesVencendo(dias = 7) {
  const [rows] = await pool.query(
    `SELECT b.id, b.product_id, b.code, b.remaining_qty, b.received_date, b.expires_date,
            b.unit_cost, b.supplier_name, b.status,
            p.name AS product_name, u.symbol AS unit_symbol, p.min_stock,
            DATEDIFF(b.expires_date, CURDATE()) AS dias_para_vencer
       FROM batches b
       JOIN products p ON p.id = b.product_id
       LEFT JOIN units u ON u.id = p.unit_id
      WHERE b.status = 'ativo' AND b.remaining_qty > 0
        AND b.expires_date >= CURDATE()
        AND b.expires_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY b.expires_date ASC, p.name ASC`,
    [dias]
  );
  return rows;
}

async function lotesVencidos() {
  const [rows] = await pool.query(
    `SELECT b.id, b.product_id, b.code, b.remaining_qty, b.received_date, b.expires_date,
            b.unit_cost, b.supplier_name, b.status,
            p.name AS product_name, u.symbol AS unit_symbol, p.min_stock,
            DATEDIFF(b.expires_date, CURDATE()) AS dias_para_vencer
       FROM batches b
       JOIN products p ON p.id = b.product_id
       LEFT JOIN units u ON u.id = p.unit_id
      WHERE b.status = 'ativo' AND b.remaining_qty > 0
        AND b.expires_date < CURDATE()
      ORDER BY b.expires_date ASC, p.name ASC`
  );
  return rows;
}

module.exports = { produtosBaixoEstoque, produtosSemEstoque, lotesVencendo, lotesVencidos };
