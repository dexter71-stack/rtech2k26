-- Galeto Gestão — Migration 005: Desperdício (Etapa 4)
-- Registro de perdas por motivo, com baixa automática do estoque em FEFO
-- (vencidos primeiro). O cabeçalho guarda a perda do ponto de vista do
-- negócio; as alocações guardam de qual lote saiu cada quantidade e o custo,
-- ligando cada baixa à sua movimentação de estoque (histórico auditável).

CREATE TABLE IF NOT EXISTS waste_records (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  quantity DECIMAL(12, 3) NOT NULL,
  total_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  reason ENUM('vencido', 'avaria', 'preparo', 'sobra', 'outro') NOT NULL,
  notes VARCHAR(500) NULL,
  waste_date DATE NOT NULL,
  status ENUM('registrado', 'estornado') NOT NULL DEFAULT 'registrado',
  reversed_at DATETIME NULL,
  user_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_waste_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_waste_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_waste_date (waste_date),
  INDEX idx_waste_product (product_id, waste_date),
  INDEX idx_waste_reason (reason),
  INDEX idx_waste_status (status, waste_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS waste_allocations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  waste_id INT UNSIGNED NOT NULL,
  batch_id INT UNSIGNED NULL,
  movement_id BIGINT UNSIGNED NULL,
  quantity DECIMAL(12, 3) NOT NULL,
  unit_cost DECIMAL(12, 4) NOT NULL DEFAULT 0,
  total_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_waste_alloc_record FOREIGN KEY (waste_id) REFERENCES waste_records (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_waste_alloc_batch FOREIGN KEY (batch_id) REFERENCES batches (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_waste_alloc_movement FOREIGN KEY (movement_id) REFERENCES movements (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_waste_alloc_record (waste_id),
  INDEX idx_waste_alloc_batch (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
