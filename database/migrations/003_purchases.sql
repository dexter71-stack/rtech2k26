-- Galeto Gestão — Migration 003: Fornecedores e Compras (Etapa 3)
-- Fornecedores com dados de contato; pedidos de compra com itens;
-- o recebimento de um pedido gera lote + movimentação de entrada (em transação).

CREATE TABLE IF NOT EXISTS suppliers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  legal_name VARCHAR(160) NULL,
  document VARCHAR(30) NULL,
  contact_name VARCHAR(120) NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(160) NULL,
  address VARCHAR(255) NULL,
  notes VARCHAR(500) NULL,
  status ENUM('ativo', 'inativo') NOT NULL DEFAULT 'ativo',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_suppliers_document (document),
  INDEX idx_suppliers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- FK que ficou pendente na Etapa 2: lote pode apontar para o fornecedor cadastrado.
ALTER TABLE batches
  ADD CONSTRAINT fk_batches_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD INDEX idx_batches_supplier (supplier_id);

CREATE TABLE IF NOT EXISTS purchases (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT UNSIGNED NOT NULL,
  status ENUM('pendente', 'recebida', 'cancelada') NOT NULL DEFAULT 'pendente',
  order_date DATE NOT NULL,
  expected_date DATE NULL,
  received_date DATE NULL,
  invoice_number VARCHAR(60) NULL,
  notes VARCHAR(500) NULL,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_purchases_user FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_purchases_supplier (supplier_id, order_date),
  INDEX idx_purchases_status (status, order_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS purchase_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity DECIMAL(12, 3) NOT NULL,
  unit_cost DECIMAL(12, 4) NOT NULL DEFAULT 0,
  expires_date DATE NOT NULL,
  batch_code VARCHAR(60) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_items_purchase FOREIGN KEY (purchase_id) REFERENCES purchases (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_items_purchase (purchase_id),
  INDEX idx_items_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
