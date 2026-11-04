-- Galeto Gestão — Migration 001: Fundação (Etapa 1)
-- Usuários, auditoria e estrutura-base de estoque (produtos, lotes e
-- movimentações ficam criados desde já para as próximas etapas).

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  username VARCHAR(40) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  position VARCHAR(80) NOT NULL DEFAULT '',
  role ENUM('admin', 'gerente', 'funcionario') NOT NULL DEFAULT 'funcionario',
  status ENUM('ativo', 'inativo') NOT NULL DEFAULT 'ativo',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  action VARCHAR(60) NOT NULL,
  module VARCHAR(60) NOT NULL,
  record_id VARCHAR(60) NULL,
  description VARCHAR(500) NULL,
  ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_module (module),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS units (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  symbol VARCHAR(20) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  category_id INT UNSIGNED NULL,
  unit_id INT UNSIGNED NULL,
  description VARCHAR(255) NULL,
  min_stock DECIMAL(12, 3) NOT NULL DEFAULT 0,
  max_stock DECIMAL(12, 3) NULL,
  reference_cost DECIMAL(12, 4) NOT NULL DEFAULT 0,
  status ENUM('ativo', 'inativo') NOT NULL DEFAULT 'ativo',
  notes VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_products_unit FOREIGN KEY (unit_id) REFERENCES units (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_products_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS batches (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  code VARCHAR(60) NULL,
  received_qty DECIMAL(12, 3) NOT NULL,
  remaining_qty DECIMAL(12, 3) NOT NULL,
  received_date DATE NOT NULL,
  manufactured_date DATE NULL,
  expires_date DATE NOT NULL,
  supplier_id INT UNSIGNED NULL,      -- FK criada na Etapa 3 (módulo de fornecedores)
  supplier_name VARCHAR(160) NULL,
  unit_cost DECIMAL(12, 4) NOT NULL DEFAULT 0,
  status ENUM('ativo', 'esgotado', 'vencido', 'cancelado') NOT NULL DEFAULT 'ativo',
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_batches_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_batches_user FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_batches_expires (expires_date),
  INDEX idx_batches_product (product_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS movements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  batch_id INT UNSIGNED NULL,
  type ENUM(
    'entrada',
    'entrada_compra',
    'entrada_ajuste',
    'saida',
    'saida_ajuste',
    'saida_desperdicio',
    'estorno'
  ) NOT NULL,
  quantity DECIMAL(12, 3) NOT NULL,
  movement_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id INT UNSIGNED NULL,
  notes VARCHAR(500) NULL,
  reference VARCHAR(120) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mov_products FOREIGN KEY (product_id) REFERENCES products (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_mov_batches FOREIGN KEY (batch_id) REFERENCES batches (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_mov_users FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_mov_product_date (product_id, movement_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
