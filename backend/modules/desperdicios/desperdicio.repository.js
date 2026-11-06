// Repositório de desperdício. Grava o cabeçalho e as alocações por lote
// dentro da mesma transação das movimentações de baixa de estoque.
const { pool } = require('../../config/db');

async function inserirRegistro(conn, { productId, quantity, totalCost, reason, notes, wasteDate, userId }) {
  const [result] = await conn.query(
    `INSERT INTO waste_records (product_id, quantity, total_cost, reason, notes, waste_date, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [productId, quantity, totalCost, reason, notes, wasteDate, userId]
  );
  return result.insertId;
}

async function inserirAlocacao(conn, { wasteId, batchId, movementId, quantity, unitCost, totalCost }) {
  const [result] = await conn.query(
    `INSERT INTO waste_allocations (waste_id, batch_id, movement_id, quantity, unit_cost, total_cost)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [wasteId, batchId, movementId, quantity, unitCost, totalCost]
  );
  return result.insertId;
}

function filtros({ productId, product, reason, dateFrom, dateTo, status }) {
  const where = [];
  const params = [];
  if (productId) { where.push('w.product_id = ?'); params.push(productId); }
  if (product) {
    where.push('w.product_id IN (SELECT id FROM products WHERE name LIKE ?)');
    params.push(`%${product}%`);
  }
  if (reason) { where.push('w.reason = ?'); params.push(reason); }
  if (status) { where.push('w.status = ?'); params.push(status); }
  if (dateFrom) { where.push('w.waste_date >= ?'); params.push(dateFrom); }
  if (dateTo) { where.push('w.waste_date <= ?'); params.push(dateTo); }
  return { whereSql: where.length ? ` WHERE ${where.join(' AND ')}` : '', params };
}

async function list({ productId, product, reason, dateFrom, dateTo, status, page, pageSize }) {
  const { whereSql, params } = filtros({ productId, product, reason, dateFrom, dateTo, status });

  // O resumo (prejuízo) ignora estornados salvo quando o filtro pede o contrário,
  // para que uma correção não continue contando como perda.
  const resumo = filtros({ productId, product, reason, dateFrom, dateTo, status: status || 'registrado' });

  const [countRows] = await pool.query(`SELECT COUNT(*) AS count FROM waste_records w${whereSql}`, params);
  const [resumoCount] = await pool.query(`SELECT COUNT(*) AS count FROM waste_records w${resumo.whereSql}`, resumo.params);
  const [totais] = await pool.query(
    `SELECT COALESCE(SUM(w.quantity), 0) AS quantity, COALESCE(SUM(w.total_cost), 0) AS cost
       FROM waste_records w${resumo.whereSql}`,
    resumo.params
  );
  const [porMotivo] = await pool.query(
    `SELECT w.reason, COUNT(*) AS count, COALESCE(SUM(w.quantity), 0) AS quantity,
            COALESCE(SUM(w.total_cost), 0) AS cost
       FROM waste_records w${resumo.whereSql}
      GROUP BY w.reason
      ORDER BY cost DESC, w.reason ASC`,
    resumo.params
  );

  const [rows] = await pool.query(
    `SELECT w.id, w.product_id, w.quantity, w.total_cost, w.reason, w.notes,
            DATE_FORMAT(w.waste_date, '%Y-%m-%d') AS waste_date,
            w.status, w.reversed_at, w.created_at, w.user_id,
            p.name AS product_name, u.symbol AS unit_symbol, us.name AS user_name,
            (SELECT GROUP_CONCAT(DISTINCT COALESCE(b.code, CONCAT('#', b.id)) ORDER BY b.expires_date SEPARATOR ', ')
               FROM waste_allocations wa JOIN batches b ON b.id = wa.batch_id
              WHERE wa.waste_id = w.id) AS batch_codes
       FROM waste_records w
       JOIN products p ON p.id = w.product_id
       LEFT JOIN units u ON u.id = p.unit_id
       LEFT JOIN users us ON us.id = w.user_id
       ${whereSql}
      ORDER BY w.waste_date DESC, w.id DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );

  return {
    total: countRows[0].count,
    page,
    pageSize,
    rows,
    resumo: {
      count: resumoCount[0].count,
      quantity: Number(totais[0].quantity) || 0,
      cost: Number(totais[0].cost) || 0,
      byReason: porMotivo.map((r) => ({
        reason: r.reason,
        count: Number(r.count) || 0,
        quantity: Number(r.quantity) || 0,
        cost: Number(r.cost) || 0,
      })),
    },
  };
}

async function buscarPorId(id) {
  const [rows] = await pool.query(
    `SELECT w.id, w.product_id, w.quantity, w.total_cost, w.reason, w.notes,
            DATE_FORMAT(w.waste_date, '%Y-%m-%d') AS waste_date,
            w.status, w.reversed_at, w.created_at, w.user_id,
            p.name AS product_name, u.symbol AS unit_symbol,
            (SELECT GROUP_CONCAT(DISTINCT COALESCE(b.code, CONCAT('#', b.id)) ORDER BY b.expires_date SEPARATOR ', ')
               FROM waste_allocations wa JOIN batches b ON b.id = wa.batch_id
              WHERE wa.waste_id = w.id) AS batch_codes
       FROM waste_records w
       JOIN products p ON p.id = w.product_id
       LEFT JOIN units u ON u.id = p.unit_id
      WHERE w.id = ?`,
    [id]
  );
  const record = rows[0];
  if (!record) return null;

  const [allocations] = await pool.query(
    'SELECT id, batch_id, movement_id, quantity, unit_cost, total_cost FROM waste_allocations WHERE waste_id = ? ORDER BY id',
    [id]
  );
  return { ...record, allocations };
}

async function marcarEstornado(conn, id) {
  await conn.query(
    "UPDATE waste_records SET status = 'estornado', reversed_at = NOW() WHERE id = ?",
    [id]
  );
}

module.exports = { inserirRegistro, inserirAlocacao, list, buscarPorId, marcarEstornado };
