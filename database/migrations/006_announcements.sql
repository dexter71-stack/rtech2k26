-- Galeto Gestão — Migration 006: Comunicação interna (Etapa 5)
-- Mural de comunicados com prioridade e controle de leitura por funcionário.
-- Arquivar não apaga: o comunicado sai do mural e continua no histórico.

CREATE TABLE IF NOT EXISTS announcements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  priority ENUM('baixa', 'media', 'alta') NOT NULL DEFAULT 'media',
  status ENUM('ativo', 'arquivado') NOT NULL DEFAULT 'ativo',
  user_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL,
  archived_at DATETIME NULL DEFAULT NULL,
  CONSTRAINT fk_announcements_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_announcements_status (status, created_at),
  INDEX idx_announcements_priority (priority, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (announcement_id, user_id),
  CONSTRAINT fk_announcement_reads_ann FOREIGN KEY (announcement_id) REFERENCES announcements (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_announcement_reads_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_announcement_reads_user (user_id, read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
