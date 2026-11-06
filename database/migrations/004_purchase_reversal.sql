-- Galeto Gestão — Migration 004: Estorno de compra recebida (correção da Etapa 3)
-- Uma compra recebida pode ser devolvida ao fornecedor: os lotes gerados no
-- recebimento são zerados (status 'cancelado') e a compra passa a 'estornada'.
-- Os totais do fornecedor e do dashboard consideram apenas compras 'recebida',
-- por isso o estorno também corrige esses indicadores.

ALTER TABLE purchases
  MODIFY COLUMN status ENUM('pendente', 'recebida', 'cancelada', 'estornada') NOT NULL DEFAULT 'pendente',
  ADD COLUMN reversed_at DATETIME NULL AFTER received_date;

-- Repara compras já recebidas cujas entradas foram estornadas avulsamente em
-- Movimentações (antes de existir o estorno de compra): quando todas as entradas
-- da compra já possuem estorno, o pedido passa a 'estornada'.
UPDATE purchases p
   SET p.status = 'estornada', p.reversed_at = NOW()
 WHERE p.status = 'recebida'
   AND EXISTS (SELECT 1 FROM movements m
                WHERE m.reference = CONCAT('compra:', p.id) AND m.type = 'entrada_compra')
   AND NOT EXISTS (
     SELECT 1 FROM movements m
      WHERE m.reference = CONCAT('compra:', p.id) AND m.type = 'entrada_compra'
        AND NOT EXISTS (SELECT 1 FROM movements e
                         WHERE e.type = 'estorno' AND e.reference = CONCAT('mov:', m.id))
   );
