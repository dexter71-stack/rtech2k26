// Repositório dos relatórios: consultas reais no banco, com os mesmos filtros
// na listagem e no resumo (o resumo nunca é "inventado" no frontend).
const { pool } = require('../../config/db');

const LIMITE = 1000;

// Executa a listagem e o resumo a partir do mesmo FROM/WHERE.
async function listarComResumo({ select, from, where, params, order, resumoSelect, limite }) {
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT ${select} ${from}${whereSql} ORDER BY ${order} LIMIT ?`,
    [...params, limite || LIMITE]
  );

  const [resumoRows] = await pool.query(
    `SELECT ${resumoSelect} FROM (SELECT ${select} ${from}${whereSql}) t`,
    params
  );

  return { rows, resumo: resumoRows[0] || {}, limite: limite || LIMITE };
}

const estoqueDe = {
  from: `
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN units u ON u.id = p.unit_id
    LEFT JOIN (
      SELECT b.product_id, SUM(b.remaining_qty) AS qtd,
             SUM(b.remaining_qty * COALESCE(NULLIF(b.unit_cost, 0), p2.reference_cost, 0)) AS valor
        FROM batches b
        JOIN products p2 ON p2.id = b.product_id
       WHERE b.status IN ('ativo', 'vencido') AND b.remaining_qty > 0
       GROUP BY b.product_id
    ) s ON s.product_id = p.id`,
  select: `p.id, p.name, c.name AS category_name, u.symbol AS unit_symbol,
           COALESCE(s.qtd, 0) AS estoque, p.min_stock, p.reference_cost,
           COALESCE(s.valor, 0) AS valor, p.status`,
};

class RelatorioRepository {
  async estoque({ search, status, abaixoMinimo }) {
    const where = [];
    const params = [];
    if (search) {
      where.push('(p.name LIKE ? OR c.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status) { where.push('p.status = ?'); params.push(status); }
    if (abaixoMinimo) where.push('p.min_stock > 0 AND COALESCE(s.qtd, 0) <= p.min_stock');

    return listarComResumo({
      select: estoqueDe.select,
      from: estoqueDe.from,
      where,
      params,
      order: 'p.name ASC',
      resumoSelect: `COUNT(*) AS total,
        COALESCE(SUM(valor), 0) AS valor,
        COALESCE(SUM(CASE WHEN min_stock > 0 AND estoque <= min_stock THEN 1 ELSE 0 END), 0) AS baixo,
        COALESCE(SUM(CASE WHEN estoque = 0 THEN 1 ELSE 0 END), 0) AS sem_estoque`,
    });
  }

  async compras({ dateFrom, dateTo, status }) {
    const where = [];
    const params = [];
    if (dateFrom) { where.push('pu.order_date >= ?'); params.push(dateFrom); }
    if (dateTo) { where.push('pu.order_date <= ?'); params.push(dateTo); }
    if (status) { where.push('pu.status = ?'); params.push(status); }

    return listarComResumo({
      select: `pu.id, s.name AS supplier_name,
               DATE_FORMAT(pu.order_date, '%Y-%m-%d') AS order_date,
               DATE_FORMAT(pu.received_date, '%Y-%m-%d') AS received_date, pu.status,
               pu.invoice_number, pu.total_amount,
               (SELECT COUNT(*) FROM purchase_items i WHERE i.purchase_id = pu.id) AS item_count`,
      from: 'FROM purchases pu JOIN suppliers s ON s.id = pu.supplier_id',
      where,
      params,
      order: 'pu.order_date DESC, pu.id DESC',
      resumoSelect: `COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN status = 'recebida' THEN 1 ELSE 0 END), 0) AS recebidas,
        COALESCE(SUM(CASE WHEN status = 'recebida' THEN total_amount ELSE 0 END), 0) AS valor,
        COALESCE(SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END), 0) AS pendentes`,
    });
  }

  async desperdicio({ dateFrom, dateTo, reason, status }) {
    const baseWhere = [];
    const baseParams = [];
    if (dateFrom) { baseWhere.push('w.waste_date >= ?'); baseParams.push(dateFrom); }
    if (dateTo) { baseWhere.push('w.waste_date <= ?'); baseParams.push(dateTo); }

    const where = [...baseWhere];
    const params = [...baseParams];
    if (reason) { where.push('w.reason = ?'); params.push(reason); }
    if (status) { where.push('w.status = ?'); params.push(status); }

    const select = `w.id, DATE_FORMAT(w.waste_date, '%Y-%m-%d') AS waste_date,
        p.name AS product_name, u.symbol AS unit_symbol,
        w.reason, w.quantity, w.total_cost, w.status, us.name AS user_name,
        (SELECT GROUP_CONCAT(COALESCE(b.code, CONCAT('#', b.id)) ORDER BY b.id SEPARATOR ', ')
           FROM waste_allocations wa
           LEFT JOIN batches b ON b.id = wa.batch_id
          WHERE wa.waste_id = w.id) AS batch_codes`;
    const from = `
      FROM waste_records w
      JOIN products p ON p.id = w.product_id
      LEFT JOIN units u ON u.id = p.unit_id
      LEFT JOIN users us ON us.id = w.user_id`;

    // O resumo usa os filtros de período/motivo, mas sempre separa registrados de estornados.
    const whereResumo = [...baseWhere];
    const paramsResumo = [...baseParams];
    if (reason) { whereResumo.push('w.reason = ?'); paramsResumo.push(reason); }
    const whereResumoSql = whereResumo.length ? ` WHERE ${whereResumo.join(' AND ')}` : '';
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT ${select} ${from}${whereSql} ORDER BY w.waste_date DESC, w.id DESC LIMIT ?`,
      [...params, LIMITE]
    );
    const [resumoRows] = await pool.query(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN w.status = 'registrado' THEN 1 ELSE 0 END), 0) AS registros,
              COALESCE(SUM(CASE WHEN w.status = 'estornado' THEN 1 ELSE 0 END), 0) AS estornados,
              COALESCE(SUM(CASE WHEN w.status = 'registrado' THEN w.quantity ELSE 0 END), 0) AS quantidade,
              COALESCE(SUM(CASE WHEN w.status = 'registrado' THEN w.total_cost ELSE 0 END), 0) AS custo
         ${from}${whereResumoSql}`,
      paramsResumo
    );

    return { rows, resumo: resumoRows[0] || {}, limite: LIMITE };
  }

  async validade({ dias }) {
    const where = [
      "b.remaining_qty > 0",
      "b.status IN ('ativo', 'vencido')",
      "b.expires_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)",
    ];
    const params = [dias];

    return listarComResumo({
      select: `b.id, b.code, p.name AS product_name, u.symbol AS unit_symbol,
               b.remaining_qty, DATE_FORMAT(b.expires_date, '%Y-%m-%d') AS expires_date,
               DATEDIFF(b.expires_date, CURDATE()) AS dias,
               b.status, b.supplier_name, b.unit_cost,
               (b.remaining_qty * COALESCE(NULLIF(b.unit_cost, 0), p.reference_cost, 0)) AS valor`,
      from: `FROM batches b
             JOIN products p ON p.id = b.product_id
             LEFT JOIN units u ON u.id = p.unit_id`,
      where,
      params,
      order: 'b.expires_date ASC, p.name ASC',
      resumoSelect: `COUNT(*) AS total,
        COALESCE(SUM(valor), 0) AS valor,
        COALESCE(SUM(CASE WHEN dias < 0 THEN 1 ELSE 0 END), 0) AS vencidos,
        COALESCE(SUM(CASE WHEN dias BETWEEN 0 AND 7 THEN 1 ELSE 0 END), 0) AS semana`,
    });
  }
}

module.exports = new RelatorioRepository();
