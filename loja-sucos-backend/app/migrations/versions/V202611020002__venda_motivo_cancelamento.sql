-- Motivo escrito de cada cancelamento de venda. Fica opcional no banco porque as vendas canceladas antes
-- desta versão não têm motivo; a API exige o motivo em todo cancelamento novo.
ALTER TABLE venda ADD COLUMN motivo_cancelamento TEXT;
