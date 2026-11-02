-- Entregas: o cliente paga produtos + taxa de entrega numa nota só, e a dona repassa a taxa ao entregador no
-- fim do dia. A taxa passa a ficar na venda para entrar no valor cobrado (inclusive no fiado), mas continua
-- fora do faturamento e do lucro (valor_total segue sendo só dos produtos).
ALTER TABLE venda
  ADD COLUMN taxa_entrega NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (taxa_entrega >= 0);

ALTER TABLE venda DROP CONSTRAINT venda_valor_pago_limite;
ALTER TABLE venda
  ADD CONSTRAINT venda_valor_pago_limite CHECK (valor_pago <= valor_total + taxa_entrega);

DROP INDEX venda_fiado_aberto_idx;
CREATE INDEX venda_fiado_aberto_idx ON venda (cliente_id, data_venda)
  WHERE forma_pagamento = 'FIADO' AND cancelada_em IS NULL AND valor_pago < valor_total + taxa_entrega;
