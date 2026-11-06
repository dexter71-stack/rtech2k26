// Repositório de compras. O recebimento é uma TRANSAÇÃO única:
// cria lote + movimentação de entrada por item e marca o pedido como recebido.
const { pool } = require('../../config/db');

const SELECT_BASE = `
  SELECT pu.id, pu.supplier_id, pu.status, pu.order_date, pu.expected_date, pu.received_date,
         pu.reversed_at, pu.invoice_number, pu.notes, pu.total_amount, pu.created_at, pu.updated_at,
         s.name AS supplier_name,
         (SELECT COUNT(*) FROM purchase_items i WHERE i.purchase_id = pu.id) AS item_count
    FROM purchases pu
    JOIN suppliers s ON s.id = pu.supplier_id`;

const ITEM_BASE = `
  SELECT i.id, i.purchase_id, i.product_id, i.quantity, i.unit_cost, i.expires_date, i.batch_code,
         p.name AS product_name, p.status AS product_status,
         u.symbol AS unit_symbol, c.name AS category_name,
         (i.quantity * i.unit_cost) AS subtotal
    FROM purchase_items i
    JOIN products p ON p.id = i.product_id
    LEFT JOIN units u ON u.id = p.unit_id
    LEFT JOIN categories c ON c.id = p.category_id`;

async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch (e) { /* conexão interrompida */ }
    throw err;
  } finally {
    conn.release();
  }
}

function totalDosItens(items) {
  return Number(items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_cost || 0), 0).toFixed(2));
}

class CompraRepository {
  async list({ supplierId, status, dateFrom, dateTo, search, page, pageSize }) {
    const where = [];
    const params = [];
    if (supplierId) { where.push('pu.supplier_id = ?'); params.push(supplierId); }
    if (status) { where.push('pu.status = ?'); params.push(status); }
    if (dateFrom) { where.push('pu.order_date >= ?'); params.push(dateFrom); }
    if (dateTo) { where.push('pu.order_date <= ?'); params.push(dateTo); }
    if (search) {
      where.push('(s.name LIKE ? OR pu.invoice_number LIKE ? OR CAST(pu.id AS CHAR) = ?)');
      params.push(`%${search}%`, `%${search}%`, String(search).replace(/\D/g, '') || '-');
    }
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS count FROM purchases pu JOIN suppliers s ON s.id = pu.supplier_id${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `${SELECT_BASE}${whereSql} ORDER BY pu.order_date DESC, pu.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    return { total: countRows[0].count, page, pageSize, rows };
  }

  async findById(id, conn = pool) {
    const [rows] = await conn.query(`${SELECT_BASE} WHERE pu.id = ?`, [id]);
    if (!rows[0]) return null;
    const [items] = await conn.query(`${ITEM_BASE} WHERE i.purchase_id = ? ORDER BY i.id`, [id]);
    return { ...rows[0], items };
  }

  async findProdutos(ids) {
    if (!ids.length) return [];
    const [rows] = await pool.query('SELECT id, name, status FROM products WHERE id IN (?)', [ids]);
    return rows;
  }

  // Validade/unidade do produto novo: unit_id enviado pela tela ou, na falta, kg.
  async resolveUnidade(conn, unitId) {
    if (unitId) {
      const [rows] = await conn.query('SELECT id FROM units WHERE id = ?', [unitId]);
      if (rows[0]) return rows[0].id;
    }
    const [kg] = await conn.query("SELECT id FROM units WHERE symbol = 'kg' LIMIT 1");
    return kg[0] ? kg[0].id : null;
  }

  // O item pode vir do catálogo (product_id) ou apenas com o nome digitado.
  // Nome que não existe é cadastrado na hora, na MESMA transação da compra:
  // se a compra falhar, o produto também não fica criado. Retorna os itens com
  // product_id resolvido e a lista de produtos criados (para auditoria).
  async resolverItens(conn, items) {
    const resolvidos = [];
    const novos = [];
    for (const item of items) {
      if (item.product_id) {
        resolvidos.push(item);
        continue;
      }
      const nome = String(item.product_name || '').trim().replace(/\s+/g, ' ');
      // Comparação sem diferenciar maiúsculas nem acentos (evita duplicar
      // "Pão de alho" ao digitar "pao de alho").
      const [existente] = await conn.query(
        'SELECT id FROM products WHERE name = ? COLLATE utf8mb4_unicode_ci LIMIT 1',
        [nome]
      );
      if (existente[0]) {
        resolvidos.push({ ...item, product_id: existente[0].id, product_name: null });
        continue;
      }
      const unitId = await this.resolveUnidade(conn, item.unit_id);
      const [ins] = await conn.query(
        "INSERT INTO products (name, unit_id, reference_cost, status) VALUES (?, ?, ?, 'ativo')",
        [nome, unitId, item.unit_cost || 0]
      );
      novos.push({ id: ins.insertId, name: nome });
      resolvidos.push({ ...item, product_id: ins.insertId, product_name: null });
    }
    return { itens: resolvidos, novos };
  }

  async create(data, actorId) {
    const { purchaseId, novos } = await withTransaction(async (conn) => {
      const { itens, novos: criados } = await this.resolverItens(conn, data.items);
      const total = totalDosItens(itens);
      const [result] = await conn.query(
        `INSERT INTO purchases
           (supplier_id, status, order_date, expected_date, invoice_number, notes, total_amount, created_by)
         VALUES (?, 'pendente', ?, ?, ?, ?, ?, ?)`,
        [data.supplier_id, data.order_date, data.expected_date || null,
         data.invoice_number || null, data.notes || null, total, actorId]
      );
      const id = result.insertId;
      for (const item of itens) {
        await conn.query(
          `INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, expires_date, batch_code)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, item.product_id, item.quantity, item.unit_cost || 0, item.expires_date, item.batch_code || null]
        );
      }
      return { purchaseId: id, novos: criados };
    });
    return { purchase: await this.findById(purchaseId), novosProdutos: novos };
  }

  async update(id, data) {
    const { novos } = await withTransaction(async (conn) => {
      let itens = null;
      let criados = [];
      if (Array.isArray(data.items)) {
        const resolvidos = await this.resolverItens(conn, data.items);
        itens = resolvidos.itens;
        criados = resolvidos.novos;
      }
      const fields = ['updated_at = NOW()'];
      const params = [];
      for (const key of ['supplier_id', 'order_date', 'expected_date', 'invoice_number', 'notes']) {
        if (data[key] !== undefined) { fields.push(`${key} = ?`); params.push(data[key]); }
      }
      if (itens) {
        fields.push('total_amount = ?');
        params.push(totalDosItens(itens));
      }
      params.push(id);
      await conn.query(`UPDATE purchases SET ${fields.join(', ')} WHERE id = ?`, params);

      if (itens) {
        await conn.query('DELETE FROM purchase_items WHERE purchase_id = ?', [id]);
        for (const item of itens) {
          await conn.query(
            `INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, expires_date, batch_code)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, item.product_id, item.quantity, item.unit_cost || 0, item.expires_date, item.batch_code || null]
          );
        }
      }
      return { novos: criados };
    });
    return { purchase: await this.findById(id), novosProdutos: novos };
  }

  // Receber: cria lote + movimentação de entrada para cada item, em transação.
  async receive(id, { received_date, invoice_number }, actorId) {
    const receipt = await withTransaction(async (conn) => {
      const [purchaseRows] = await conn.query(
        'SELECT id, supplier_id, status, order_date FROM purchases WHERE id = ? FOR UPDATE',
        [id]
      );
      const purchase = purchaseRows[0];
      if (!purchase) throw new Error('PURCHASE_NOT_FOUND');
      if (purchase.status !== 'pendente') throw new Error(`PURCHASE_STATUS:${purchase.status}`);

      const [supplierRows] = await conn.query(
        'SELECT id, name, status FROM suppliers WHERE id = ?', [purchase.supplier_id]
      );
      const supplier = supplierRows[0];

      const [items] = await conn.query(`${ITEM_BASE} WHERE i.purchase_id = ? ORDER BY i.id`, [id]);
      if (!items.length) throw new Error('PURCHASE_EMPTY');

      const inativos = items.filter((i) => i.product_status !== 'ativo');
      if (inativos.length) {
        throw new Error(`PRODUTO_INATIVO:${inativos.map((i) => i.product_name).join(', ')}`);
      }

      for (const item of items) {
        const [vencRows] = await conn.query('SELECT CURDATE() >= ? AS vencido', [item.expires_date]);
        const vencido = vencRows[0].vencido === 1;

        const [batchResult] = await conn.query(
          `INSERT INTO batches
             (product_id, code, received_qty, remaining_qty, received_date, expires_date,
              supplier_id, supplier_name, unit_cost, status, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            item.product_id, item.batch_code || null, item.quantity, item.quantity,
            received_date, item.expires_date, supplier ? supplier.id : null,
            supplier ? supplier.name : null, item.unit_cost, vencido ? 'vencido' : 'ativo', actorId,
          ]
        );

        await conn.query(
          `INSERT INTO movements
             (product_id, batch_id, type, quantity, movement_date, user_id, notes, reference)
           VALUES (?, ?, 'entrada_compra', ?, NOW(), ?, ?, ?)`,
          [
            item.product_id, batchResult.insertId, item.quantity, actorId,
            `Recebimento da compra #${id} — ${supplier ? supplier.name : 'fornecedor'}`,
            `compra:${id}`,
          ]
        );

        // Preço de referência do produto acompanha a última compra recebida.
        if (Number(item.unit_cost) > 0) {
          await conn.query('UPDATE products SET reference_cost = ? WHERE id = ?', [item.unit_cost, item.product_id]);
        }
      }

      await conn.query(
        `UPDATE purchases
            SET status = 'recebida', received_date = ?,
                invoice_number = COALESCE(?, invoice_number), updated_at = NOW()
          WHERE id = ?`,
        [received_date, invoice_number || null, id]
      );

      return { itens: items.length, supplierName: supplier ? supplier.name : null };
    });
    return { ...receipt, purchase: await this.findById(id) };
  }

  // Cancela somente pedido pendente; nada do estoque é tocado.
  async cancel(id) {
    const [result] = await pool.query(
      `UPDATE purchases SET status = 'cancelada', updated_at = NOW()
        WHERE id = ? AND status = 'pendente'`,
      [id]
    );
    return result.affectedRows;
  }

  // Estorna uma compra recebida: devolve ao fornecedor os lotes criados no
  // recebimento (saldo zerado, lote cancelado) e registra a movimentação de
  // estorno correspondente. Transação única — ou tudo volta, ou nada muda.
  // Entradas já estornadas avulsamente em Movimentações são apenas ignoradas.
  async reverse(id, actorId) {
    return withTransaction(async (conn) => {
      const [purchaseRows] = await conn.query(
        'SELECT id, supplier_id, status FROM purchases WHERE id = ? FOR UPDATE',
        [id]
      );
      const purchase = purchaseRows[0];
      if (!purchase) throw new Error('PURCHASE_NOT_FOUND');
      if (purchase.status !== 'recebida') throw new Error(`PURCHASE_STATUS:${purchase.status}`);

      const [entradas] = await conn.query(
        `SELECT m.id, m.product_id, m.batch_id, m.quantity, p.name AS product_name
           FROM movements m JOIN products p ON p.id = m.product_id
          WHERE m.reference = ? AND m.type = 'entrada_compra'
          ORDER BY m.id`,
        [`compra:${id}`]
      );
      if (!entradas.length) throw new Error('PURCHASE_SEM_ENTRADA');

      let devolvidos = 0;
      for (const mov of entradas) {
        const [estornos] = await conn.query(
          "SELECT COUNT(*) AS count FROM movements WHERE type = 'estorno' AND reference = ?",
          [`mov:${mov.id}`]
        );
        if (estornos[0].count > 0) continue; // item já devolvido avulsamente

        const [batchRows] = await conn.query(
          'SELECT id, received_qty, remaining_qty FROM batches WHERE id = ? FOR UPDATE',
          [mov.batch_id]
        );
        const lote = batchRows[0];
        if (!lote) throw new Error(`LOTE_AUSENTE:${mov.product_name}`);
        if (Number(lote.remaining_qty) < Number(mov.quantity)) {
          const consumido = Number(lote.received_qty) - Number(lote.remaining_qty);
          throw new Error(`LOTE_CONSUMIDO:${mov.product_name}:${consumido}`);
        }

        await conn.query(
          "UPDATE batches SET remaining_qty = 0, status = 'cancelado' WHERE id = ?",
          [mov.batch_id]
        );
        await conn.query(
          `INSERT INTO movements
             (product_id, batch_id, type, quantity, movement_date, user_id, notes, reference)
           VALUES (?, ?, 'estorno', ?, NOW(), ?, ?, ?)`,
          [
            mov.product_id, mov.batch_id, mov.quantity, actorId,
            `Estorno do movimento #${mov.id} — Devolução da compra #${id}`,
            `mov:${mov.id}`,
          ]
        );
        devolvidos += 1;
      }

      await conn.query(
        `UPDATE purchases
            SET status = 'estornada', reversed_at = NOW(), updated_at = NOW()
          WHERE id = ?`,
        [id]
      );

      return { itens: devolvidos };
    });
  }

  // Sincroniza o status da compra após estornos avulsos em Movimentações:
  // se todas as entradas da compra já foram estornadas, o pedido vira 'estornada'
  // e deixa de somar no fornecedor e no dashboard.
  async syncStatusFromMovements(purchaseId) {
    const [rows] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM movements
           WHERE reference = ? AND type = 'entrada_compra') AS entradas,
         (SELECT COUNT(*) FROM movements m
           WHERE m.reference = ? AND m.type = 'entrada_compra'
             AND NOT EXISTS (SELECT 1 FROM movements e
                              WHERE e.type = 'estorno' AND e.reference = CONCAT('mov:', m.id))) AS pendentes`,
      [`compra:${purchaseId}`, `compra:${purchaseId}`]
    );
    if (!Number(rows[0].entradas) || Number(rows[0].pendentes) > 0) return false;

    const [result] = await pool.query(
      `UPDATE purchases SET status = 'estornada', reversed_at = NOW(), updated_at = NOW()
        WHERE id = ? AND status = 'recebida'`,
      [purchaseId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = new CompraRepository();
