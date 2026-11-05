// Handlers HTTP de movimentações.
const movimentacaoService = require('./movimentacao.service');
const { asyncHandler, badRequest } = require('../../utils/errors');
const { TIPOS } = require('./movimentacao.validator');
const { pool } = require('../../config/db');

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(10, Number(req.query.pageSize) || 30));
  const productId = Number(req.query.product_id) || undefined;
  const type = TIPOS.includes(req.query.type) ? req.query.type : undefined;
  const dateFrom = DATA_RE.test(req.query.dateFrom || '') ? req.query.dateFrom : undefined;
  const dateTo = DATA_RE.test(req.query.dateTo || '') ? req.query.dateTo : undefined;

  res.json(await movimentacaoService.list({ productId, type, dateFrom, dateTo, page, pageSize }));
});

exports.create = asyncHandler(async (req, res) => {
  const result = await movimentacaoService.create(req.movementData, { ...req.user, ip: req.ip });
  res.status(201).json({ movement: result.movement, saidas: result.movimentacoes.length > 1 ? result.movimentacoes : undefined });
});

exports.reverse = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Identificador inválido.');
  const movement = await movimentacaoService.reverse(id, { ...req.user, ip: req.ip });
  res.status(201).json({ movement });
});

// Lista de lotes disponíveis de um produto (para escolha manual / FEFO no form).
exports.lotesProduto = asyncHandler(async (req, res) => {
  const productId = Number(req.params.productId);
  if (!Number.isInteger(productId) || productId <= 0) throw badRequest('Produto inválido.');
  const incluirVencidos = req.query.incluir_vencidos === '1';
  const [rows] = await pool.query(
    `SELECT id, code, remaining_qty, received_qty, received_date, expires_date, unit_cost, supplier_name, status
       FROM batches
      WHERE product_id = ? ${incluirVencidos ? "AND status IN ('ativo','vencido')" : "AND status = 'ativo'"}
          AND remaining_qty > 0
      ORDER BY expires_date ASC, received_date ASC, id ASC`,
    [productId]
  );
  const total = rows.reduce((s, r) => s + Number(r.remaining_qty), 0);
  res.json({ rows, total });
});
