-- Galeto Gestão — Migration 002: Estoque (Etapa 2)
-- As tabelas de produtos, lotes e movimentações já existem (Migration 001).
-- Aqui adicionamos apenas os índices usados pelas novas consultas do módulo.

ALTER TABLE movements
  ADD INDEX idx_mov_batch (batch_id),
  ADD INDEX idx_mov_type_date (type, movement_date);

ALTER TABLE batches
  ADD INDEX idx_batches_status_exp (status, expires_date);
