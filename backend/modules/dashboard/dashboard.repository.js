// Repositório do dashboard: indicadores calculados no banco.
// Compras (Etapa 3) e desperdício (Etapa 4) entram nos totais do mês.
const { pool } = require('../../config/db');

async function summary() {
  const [stats] = await pool.query(
    `
    SELECT
      (SELECT COUNT(*) FROM products WHERE status = 'ativo') AS ingredientes,
      (SELECT COALESCE(SUM(b.remaining_qty), 0)
         FROM batches b JOIN products p ON p.id = b.product_id
        WHERE b.status = 'ativo' AND b.remaining_qty > 0 AND p.status = 'ativo') AS estoque_qtd,
      (SELECT COUNT(*) FROM products p
        WHERE p.status = 'ativo' AND p.min_stock > 0
          AND COALESCE((SELECT SUM(b.remaining_qty) FROM batches b
                         WHERE b.product_id = p.id AND b.status = 'ativo'), 0) > 0
          AND COALESCE((SELECT SUM(b.remaining_qty) FROM batches b
                         WHERE b.product_id = p.id AND b.status = 'ativo'), 0) <= p.min_stock) AS baixo_estoque,
      (SELECT COUNT(*) FROM products p
        WHERE p.status = 'ativo'
          AND COALESCE((SELECT SUM(b.remaining_qty) FROM batches b
                         WHERE b.product_id = p.id AND b.status = 'ativo'), 0) = 0) AS sem_estoque,
      (SELECT COUNT(*) FROM batches
        WHERE status = 'ativo' AND remaining_qty > 0
          AND expires_date >= CURDATE() AND expires_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)) AS proximos_vencimento,
      (SELECT COUNT(*) FROM batches
        WHERE status = 'ativo' AND remaining_qty > 0 AND expires_date < CURDATE()) AS vencidos,
      (SELECT COUNT(*) FROM purchases
        WHERE status = 'recebida'
          AND DATE_FORMAT(received_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')) AS compras_mes,
      (SELECT COALESCE(SUM(total_amount), 0) FROM purchases
        WHERE status = 'recebida'
          AND DATE_FORMAT(received_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')) AS compras_mes_total,
      (SELECT COUNT(*) FROM waste_records
        WHERE status = 'registrado'
          AND DATE_FORMAT(waste_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')) AS desperdicio_mes,
      (SELECT COALESCE(SUM(total_cost), 0) FROM waste_records
        WHERE status = 'registrado'
          AND DATE_FORMAT(waste_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')) AS desperdicio_mes_total,
      (SELECT COUNT(*) FROM users WHERE status = 'ativo') AS funcionarios_ativos,
      (SELECT COUNT(*) FROM audit_log WHERE DATE(created_at) = CURDATE()) AS eventos_hoje
    `
  );

  const atividade = await recentActivity(8);

  return {
    ingredientes: Number(stats[0].ingredientes) || 0,
    valorEstoque: { quantidade: stats[0].estoque_qtd },
    baixoEstoque: Number(stats[0].baixo_estoque) || 0,
    semEstoque: Number(stats[0].sem_estoque) || 0,
    proximosVencimento: Number(stats[0].proximos_vencimento) || 0,
    vencidos: Number(stats[0].vencidos) || 0,
    funcionariosAtivos: Number(stats[0].funcionarios_ativos) || 0,
    eventosHoje: Number(stats[0].eventos_hoje) || 0,
    comprasMes: {
      count: Number(stats[0].compras_mes) || 0,
      total: Number(stats[0].compras_mes_total) || 0,
    },
    desperdicioMes: {
      count: Number(stats[0].desperdicio_mes) || 0,
      total: Number(stats[0].desperdicio_mes_total) || 0,
    },
    atividade,
  };
}

async function recentActivity(limit) {
  const [rows] = await pool.query(
    `SELECT a.id, a.action, a.module, a.description, a.created_at, u.name AS user_name
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ?`,
    [limit || 8]
  );
  return rows;
}

module.exports = { summary, recentActivity };
