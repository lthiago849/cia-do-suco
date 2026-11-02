-- Correção de dados (02/11/2026): nas primeiras compras de polpa e açúcar foi digitado o preço por kg no
-- campo "valor pago no total" (ex.: 5 kg de caju "por R$ 11,00", quando foi R$ 11,00 o kg).
-- O custo dos ingredientes já tinha sido corrigido à mão para o preço por kg; aqui só o registro da compra
-- passa a ter o total certo (quantidade × preço por kg), para o histórico de compras e a "última compra"
-- baterem. Pega apenas compras daquele dia em que o total é igual ao custo por kg atual do ingrediente
-- (o sinal do erro) e com mais de 1 kg. Não mexe em estoque, custo médio, produções nem vendas.
UPDATE entrada_estoque e
SET custo_total = round(e.quantidade * i.custo_unitario, 2),
    observacao = concat_ws(' · ', nullif(e.observacao, ''),
                           'Total corrigido em 02/11/2026: tinha sido lançado R$ ' || e.custo_total || ' (preço do kg)')
FROM ingrediente i
WHERE e.ingrediente_id = i.id
  AND i.tipo IN ('POLPA', 'ACUCAR')
  AND e.quantidade > 1
  AND e.custo_total = i.custo_unitario
  AND e.created_at < '2026-11-03 00:00:00-03';
