-- Galeto Gestão — Migration 007: Configurações (Etapa 6)
-- Parâmetros da galeteria usados em tempo real pelo sistema:
--   establishment_name/address/phone — identificação exibida no layout e na tela;
--   alert_days — janela (em dias) dos alertas de validade no dashboard e em /api/alertas.

CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(60) PRIMARY KEY,
  setting_value VARCHAR(500) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
  ('establishment_name', 'Galeto São Luís'),
  ('establishment_address', 'Jacintinho, Maceió/AL'),
  ('establishment_phone', ''),
  ('alert_days', '7');
