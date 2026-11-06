// Repositório/gravação de movimentações e lotes em TRANSAÇÃO SQL.
// Entradas criam lote; saídas consomem em FEFO (multi-lote quando necessário);
// estornos compensam a movimentação original de forma auditável.
const { pool } = require('../../config/db');

const BATCH_COLS = 'id, product_id, code, received_qty, remaining_qty, received_date, manufactured_date, expires_date, supplier_id, supplier_name, unit_cost, status, created_by';

// Executa fn(conn) dentro de uma transação: commit em sucesso, rollback em falha.
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch (e) { /* conexão já interrompida */ }
    throw err;
  } finally {
    conn.release();
  }
}

// Atualiza lotes vencidos antes da operação (atualização "preguiçosa")
// para que o FEFO nunca consuma um lote já passado da validade.
async function marcarVencidos(conn) {
  await conn.query(
    `UPDATE batches SET status = 'vencido'
      WHERE status = 'ativo' AND remaining_qty > 0 AND expires_date < CURDATE()`
  );
}

async function encontrarProduto(conn, productId) {
  const [rows] = await conn.query(
    `SELECT p.id, p.name, p.status, p.reference_cost, u.symbol AS unit_symbol
       FROM products p LEFT JOIN units u ON u.id = p.unit_id
      WHERE p.id = ? FOR UPDATE`,
    [productId]
  );
  return rows[0] || null;
}

async function criarLote(conn, { productId, data, actorId }) {
  // Lote recebido já vencido (ou com validade anterior ao recebimento) nasce vencido.
  const [statusRows] = await conn.query('SELECT CURDATE() >= ? AS vencido', [data.expires_date]);
  const vencido = statusRows[0].vencido === 1;
  const [result] = await conn.query(
    `INSERT INTO batches
       (product_id, code, received_qty, remaining_qty, received_date, manufactured_date,
        expires_date, supplier_name, unit_cost, status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      productId,
      data.code || null,
      data.quantity,
      data.quantity,
      data.received_date,
      data.manufactured_date || null,
      data.expires_date,
      data.supplier_name || null,
      data.unit_cost || 0,
      vencido ? 'vencido' : 'ativo',
      actorId,
    ]
  );
  const [rows] = await conn.query(`SELECT ${BATCH_COLS} FROM batches WHERE id = ?`, [result.insertId]);
  return rows[0];
}

async function buscarLoteParaAtualizar(conn, batchId) {
  const [rows] = await conn.query(
    `SELECT ${BATCH_COLS} FROM batches WHERE id = ? FOR UPDATE`,
    [batchId]
  );
  return rows[0] || null;
}

// FEFO (First Expired, First Out): lotes bloqueados para atualização,
// ordenados pelo vencimento mais próximo e, em empate, pelo recebimento mais antigo.
async function lotesFefo(conn, productId, { incluirVencidos = false, loteEspecifico = null } = {}) {
  if (loteEspecifico) {
    const [rows] = await conn.query(
      `SELECT ${BATCH_COLS} FROM batches
        WHERE id = ? AND product_id = ? AND remaining_qty > 0 AND status = 'ativo'
        FOR UPDATE`,
      [loteEspecifico, productId]
    );
    return rows;
  }
  const statusFiltro = incluirVencidos
    ? `status IN ('ativo', 'vencido')`
    : `status = 'ativo'`;
  const [rows] = await conn.query(
    `SELECT ${BATCH_COLS} FROM batches
      WHERE product_id = ? AND remaining_qty > 0 AND ${statusFiltro}
      ORDER BY expires_date ASC, received_date ASC, id ASC
      FOR UPDATE`,
    [productId]
  );
  return rows;
}

// Aplica um delta no saldo de um lote e coerencia o status do estoque.
// retorno < 0 consome; retorno > 0 restaura.
async function aplicarSaldoLote(conn, batchId, delta) {
  const [rows] = await conn.query(
    `UPDATE batches
        SET remaining_qty = remaining_qty + ?
      WHERE id = ?`,
    [delta, batchId]
  );
  if (rows.affectedRows !== 1) return null;

  const [after] = await conn.query('SELECT id, remaining_qty, received_qty, status FROM batches WHERE id = ?', [batchId]);
  const lote = after[0];

  // Consome tudo -> esgotado; restaura a partir de 0 (sem estar cancelado) -> ativo.
  if (lote.remaining_qty <= 0) {
    await conn.query("UPDATE batches SET remaining_qty = 0, status = 'esgotado' WHERE id = ?", [batchId]);
  } else if (lote.status === 'esgotado') {
    await conn.query("UPDATE batches SET status = 'ativo' WHERE id = ?", [batchId]);
  }
  const [finalRows] = await conn.query(`SELECT ${BATCH_COLS} FROM batches WHERE id = ?`, [batchId]);
  return finalRows[0];
}

async function inserirMovimento(conn, { productId, batchId, type, quantity, userId, notes, reference }) {
  const [result] = await conn.query(
    `INSERT INTO movements (product_id, batch_id, type, quantity, movement_date, user_id, notes, reference)
     VALUES (?, ?, ?, ?, NOW(), ?, ?, ?)`,
    [productId, batchId, type, quantity, userId, notes || null, reference || null]
  );
  return result.insertId;
}

// Consultas de leitura (sem transação) -------------------------------

async function consultarMovimento(movementId) {
  const [rows] = await pool.query(
    `SELECT m.*, p.name AS product_name, u.symbol AS unit_symbol,
            u2.name AS user_name, b.code AS batch_code, b.expires_date AS batch_expires_date
       FROM movements m
       JOIN products p ON p.id = m.product_id
       LEFT JOIN units u ON u.id = p.unit_id
       LEFT JOIN users u2 ON u2.id = m.user_id
       LEFT JOIN batches b ON b.id = m.batch_id
      WHERE m.id = ?`,
    [movementId]
  );
  return rows[0] || null;
}

async function existeEstorno(originalId) {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS count FROM movements WHERE type = 'estorno' AND reference = ?",
    [`mov:${originalId}`]
  );
  return rows[0].count > 0;
}

async function list({ productId, type, dateFrom, dateTo, page, pageSize }) {
  const where = [];
  const params = [];

  if (productId) { where.push('m.product_id = ?'); params.push(productId); }
  if (type) { where.push('m.type = ?'); params.push(type); }
  if (dateFrom) { where.push('m.movement_date >= ?'); params.push(`${dateFrom} 00:00:00`); }
  if (dateTo) { where.push('m.movement_date <= ?'); params.push(`${dateTo} 23:59:59`); }
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const [countRows] = await pool.query(`SELECT COUNT(*) AS count FROM movements m${whereSql}`, params);
  const total = countRows[0].count;

  const [rows] = await pool.query(
    `SELECT m.id, m.product_id, m.batch_id, m.type, m.quantity, m.movement_date,
            m.notes, m.reference, u.name AS user_name,
            p.name AS product_name, un.symbol AS unit_symbol, b.code AS batch_code
       FROM movements m
       JOIN products p ON p.id = m.product_id
       LEFT JOIN units un ON un.id = p.unit_id
       LEFT JOIN users u ON u.id = m.user_id
       LEFT JOIN batches b ON b.id = m.batch_id
      ${whereSql}
      ORDER BY m.movement_date DESC, m.id DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  return { total, page, pageSize, rows };
}

async function totaisPorProduto(productId) {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN type LIKE 'entrada%' THEN quantity
                              WHEN type LIKE 'saida%' THEN -quantity
                              ELSE 0 END), 0) AS saldo
       FROM movements WHERE product_id = ?`,
    [productId]
  );
  return Number(rows[0].saldo) || 0;
}

module.exports = {
  withTransaction,
  marcarVencidos,
  encontrarProduto,
  criarLote,
  buscarLoteParaAtualizar,
  lotesFefo,
  aplicarSaldoLote,
  inserirMovimento,
  consultarMovimento,
  existeEstorno,
  list,
  totaisPorProduto,
};
