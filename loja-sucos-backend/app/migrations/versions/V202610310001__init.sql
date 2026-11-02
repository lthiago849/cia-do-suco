CREATE TYPE tipo_usuario AS ENUM (
  'ADMIN',
  'ATENDENTE'
);

CREATE TYPE categoria_produto AS ENUM (
  'SUCO',
  'PICOLE',
  'MORENINHA',
  'CREMOSINHO'
);

CREATE TYPE tipo_ingrediente AS ENUM (
  'POLPA',
  'ACUCAR',
  'GARRAFA',
  'OUTRO'
);

CREATE TYPE status_pedido AS ENUM (
  'NOVO',
  'ENTREGUE',
  'CANCELADO'
);

CREATE TYPE origem_pedido AS ENUM (
  'WHATSAPP',
  'ATENDENTE'
);

CREATE TYPE condicao_garrafa AS ENUM (
  'LIMPA',
  'SUJA'
);

CREATE TYPE unidade_medida AS ENUM (
  'KG',
  'L',
  'UN'
);

CREATE TYPE forma_pagamento AS ENUM (
  'PIX',
  'DINHEIRO',
  'DEBITO',
  'CREDITO',
  'FIADO'
);

-- ========== USUÁRIOS (somente funcionários) ==========

CREATE TABLE usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_usuario VARCHAR(255) NOT NULL UNIQUE,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  senha VARCHAR(255) NOT NULL,
  tipo tipo_usuario NOT NULL,
  -- somente dígitos, com DDI (ex.: 5591988887777)
  telefone VARCHAR(20) UNIQUE,
  -- recebe por e-mail o relatório diário de estoque das 8h
  recebe_relatorio BOOLEAN NOT NULL DEFAULT TRUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== ESTOQUE ==========

CREATE TABLE ingrediente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL UNIQUE,
  tipo tipo_ingrediente NOT NULL,
  unidade_medida unidade_medida NOT NULL,
  quantidade_estoque NUMERIC(10, 3) NOT NULL DEFAULT 0 CHECK (quantidade_estoque >= 0),
  -- custo por unidade de medida (média ponderada das entradas)
  custo_unitario NUMERIC(10, 4) NOT NULL DEFAULT 0 CHECK (custo_unitario >= 0),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  categoria categoria_produto NOT NULL,
  -- polpa consumida na produção; nulo para produtos comprados prontos
  ingrediente_id UUID REFERENCES ingrediente (id) ON DELETE RESTRICT,
  preco_venda NUMERIC(10, 2) NOT NULL CHECK (preco_venda >= 0),
  -- custo médio por unidade (produção ou compra)
  custo_unitario NUMERIC(10, 4) NOT NULL DEFAULT 0 CHECK (custo_unitario >= 0),
  quantidade_estoque INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_estoque >= 0),
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT produto_nome_categoria_unique UNIQUE (nome, categoria)
);

CREATE TABLE producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES produto (id) ON DELETE RESTRICT,
  usuario_id UUID NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  quantidade_produzida INTEGER NOT NULL CHECK (quantidade_produzida > 0),
  polpa_usada NUMERIC(10, 3) NOT NULL CHECK (polpa_usada >= 0),
  acucar_usado NUMERIC(10, 3) NOT NULL CHECK (acucar_usado >= 0),
  -- uma garrafa PET por unidade produzida
  garrafas_usadas INTEGER NOT NULL DEFAULT 0 CHECK (garrafas_usadas >= 0),
  custo_total NUMERIC(10, 2) NOT NULL CHECK (custo_total >= 0),
  produzido_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX producao_produzido_em_idx ON producao (produzido_em);

-- Compra de ingrediente ou de produto pronto (picolé, moreninha, cremosinho)
CREATE TABLE entrada_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES produto (id) ON DELETE RESTRICT,
  ingrediente_id UUID REFERENCES ingrediente (id) ON DELETE RESTRICT,
  usuario_id UUID NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  quantidade NUMERIC(10, 3) NOT NULL CHECK (quantidade > 0),
  custo_total NUMERIC(10, 2) NOT NULL CHECK (custo_total >= 0),
  -- só nas compras de garrafa: vieram limpas ou sujas
  condicao_garrafa condicao_garrafa,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT entrada_estoque_um_alvo CHECK (num_nonnulls(produto_id, ingrediente_id) = 1)
);

CREATE INDEX entrada_estoque_created_at_idx ON entrada_estoque (created_at);

-- Ingrediente ou produto jogado fora (garrafas sujas demais, suco que estragou, picolé que derreteu...).
-- O custo do que foi descartado é repassado para o que sobrou no estoque; valor_perdido guarda quanto foi.
CREATE TABLE descarte_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES produto (id) ON DELETE RESTRICT,
  ingrediente_id UUID REFERENCES ingrediente (id) ON DELETE RESTRICT,
  -- compra de onde vieram os itens descartados (opcional)
  entrada_estoque_id UUID REFERENCES entrada_estoque (id) ON DELETE RESTRICT,
  usuario_id UUID NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  quantidade NUMERIC(10, 3) NOT NULL CHECK (quantidade > 0),
  valor_perdido NUMERIC(10, 2) NOT NULL CHECK (valor_perdido >= 0),
  motivo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT descarte_estoque_um_alvo CHECK (num_nonnulls(produto_id, ingrediente_id) = 1)
);

CREATE INDEX descarte_estoque_created_at_idx ON descarte_estoque (created_at);
CREATE INDEX descarte_estoque_entrada_idx ON descarte_estoque (entrada_estoque_id);

-- ========== CLIENTES ==========

CREATE TABLE cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  -- somente dígitos, com DDI (ex.: 5591988887777); identifica o cliente no WhatsApp
  telefone VARCHAR(20) UNIQUE,
  observacao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE endereco_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES cliente (id) ON DELETE CASCADE,
  logradouro VARCHAR(255),
  numero VARCHAR(20),
  bairro VARCHAR(100),
  complemento VARCHAR(255),
  ponto_referencia TEXT,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  -- endereços antigos ficam como histórico (ativo = false)
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  confirmado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT endereco_cliente_tem_conteudo CHECK (
    logradouro IS NOT NULL OR ponto_referencia IS NOT NULL OR latitude IS NOT NULL
  ),
  CONSTRAINT endereco_cliente_lat_long CHECK ((latitude IS NULL) = (longitude IS NULL))
);

-- No máximo um endereço atual por cliente
CREATE UNIQUE INDEX endereco_cliente_um_ativo_idx ON endereco_cliente (cliente_id) WHERE ativo;

-- ========== VENDAS ==========

-- Percentual cobrado pela maquininha/banco em cada forma de pagamento. Configurado pelo admin.
CREATE TABLE taxa_pagamento (
  forma_pagamento forma_pagamento PRIMARY KEY CHECK (forma_pagamento <> 'FIADO'),
  percentual NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (percentual >= 0 AND percentual < 100),
  -- o cliente paga a taxa: o valor passado na máquina é o total + o acréscimo
  repassar_cliente BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE venda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  cliente_id UUID REFERENCES cliente (id) ON DELETE RESTRICT,
  forma_pagamento forma_pagamento NOT NULL,
  valor_total NUMERIC(10, 2) NOT NULL CHECK (valor_total >= 0),
  custo_total NUMERIC(10, 2) NOT NULL CHECK (custo_total >= 0),
  valor_pago NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (valor_pago >= 0),
  -- acréscimo pago pelo cliente para cobrir a taxa do cartão (valor passado na máquina = valor_total + acréscimo)
  acrescimo_pagamento NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (acrescimo_pagamento >= 0),
  -- taxa da maquininha cobrada nesta venda, sobre o valor passado na máquina
  taxa_pagamento NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (taxa_pagamento >= 0),
  observacao TEXT,
  data_venda TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelada_em TIMESTAMPTZ,
  cancelada_por UUID REFERENCES usuario (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT venda_fiado_exige_cliente CHECK (forma_pagamento <> 'FIADO' OR cliente_id IS NOT NULL),
  CONSTRAINT venda_valor_pago_limite CHECK (valor_pago <= valor_total),
  CONSTRAINT venda_cancelamento CHECK ((cancelada_em IS NULL) = (cancelada_por IS NULL))
);

CREATE INDEX venda_data_venda_idx ON venda (data_venda);
CREATE INDEX venda_fiado_aberto_idx ON venda (cliente_id, data_venda)
  WHERE forma_pagamento = 'FIADO' AND cancelada_em IS NULL AND valor_pago < valor_total;

CREATE TABLE item_venda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID NOT NULL REFERENCES venda (id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produto (id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  -- cópias do momento da venda, para o histórico não mudar quando o preço mudar
  preco_unitario NUMERIC(10, 2) NOT NULL CHECK (preco_unitario >= 0),
  custo_unitario NUMERIC(10, 4) NOT NULL CHECK (custo_unitario >= 0),
  CONSTRAINT item_venda_produto_unico UNIQUE (venda_id, produto_id)
);

CREATE INDEX item_venda_produto_idx ON item_venda (produto_id);

CREATE TABLE pagamento_fiado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES cliente (id) ON DELETE RESTRICT,
  usuario_id UUID NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  valor NUMERIC(10, 2) NOT NULL CHECK (valor > 0),
  forma_pagamento forma_pagamento NOT NULL CHECK (forma_pagamento <> 'FIADO'),
  acrescimo_pagamento NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (acrescimo_pagamento >= 0),
  taxa_pagamento NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (taxa_pagamento >= 0),
  observacao TEXT,
  pago_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pagamento_fiado_cliente_idx ON pagamento_fiado (cliente_id, pago_em);

-- ========== PEDIDOS DE ENTREGA ==========

-- Pedido recebido pelo WhatsApp (bot) ou cadastrado pelo atendente. Só vira venda quando o atendente
-- confirma a entrega; até lá não mexe no estoque nem entra nos relatórios.
CREATE TABLE pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES cliente (id) ON DELETE RESTRICT,
  -- endereço usado nesta entrega (o histórico de endereços do cliente nunca é apagado)
  endereco_id UUID REFERENCES endereco_cliente (id) ON DELETE RESTRICT,
  origem origem_pedido NOT NULL,
  status status_pedido NOT NULL DEFAULT 'NOVO',
  -- opcional até a confirmação; fiado só pode ser escolhido pelo atendente
  forma_pagamento forma_pagamento,
  observacao TEXT,
  -- nulo quando o pedido veio do bot
  criado_por UUID REFERENCES usuario (id) ON DELETE RESTRICT,
  -- funcionário que entregou (informado na confirmação)
  entregador_id UUID REFERENCES usuario (id) ON DELETE RESTRICT,
  -- cobrada do cliente e repassada ao entregador: não é receita da loja
  taxa_entrega NUMERIC(10, 2) CHECK (taxa_entrega >= 0),
  venda_id UUID UNIQUE REFERENCES venda (id) ON DELETE RESTRICT,
  confirmado_por UUID REFERENCES usuario (id) ON DELETE RESTRICT,
  motivo_cancelamento TEXT,
  cancelado_por UUID REFERENCES usuario (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  entregue_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  CONSTRAINT pedido_entregue CHECK (
    status <> 'ENTREGUE'
    OR (venda_id IS NOT NULL AND entregador_id IS NOT NULL AND endereco_id IS NOT NULL AND taxa_entrega IS NOT NULL
        AND entregue_em IS NOT NULL AND confirmado_por IS NOT NULL)
  ),
  CONSTRAINT pedido_cancelado CHECK (
    status <> 'CANCELADO' OR (cancelado_em IS NOT NULL AND cancelado_por IS NOT NULL AND motivo_cancelamento IS NOT NULL)
  )
);

CREATE INDEX pedido_status_idx ON pedido (status);
CREATE INDEX pedido_created_at_idx ON pedido (created_at);
CREATE INDEX pedido_entregador_idx ON pedido (entregador_id, entregue_em);

CREATE TABLE item_pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedido (id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produto (id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  CONSTRAINT item_pedido_produto_unico UNIQUE (pedido_id, produto_id)
);

-- ========== RELATÓRIO DIÁRIO DE ESTOQUE ==========

-- Um registro por dia do envio automático das 8h. A chave no dia garante um único envio, mesmo que a API
-- reinicie ou rode com mais de um processo.
CREATE TABLE envio_relatorio (
  data DATE PRIMARY KEY,
  enviado_em TIMESTAMPTZ,
  destinatarios INTEGER NOT NULL DEFAULT 0,
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== DADOS INICIAIS ==========

-- Taxas começam zeradas; o admin informa os percentuais da maquininha na tela de taxas
INSERT INTO taxa_pagamento (forma_pagamento) VALUES ('PIX'), ('DINHEIRO'), ('DEBITO'), ('CREDITO');

-- A produção de sucos desconta o açúcar e uma garrafa PET por suco dos ingredientes desses tipos.
-- A garrafa começa com custo de R$ 0,50, que muda a cada compra registrada (média ponderada).
INSERT INTO ingrediente (nome, tipo, unidade_medida, custo_unitario) VALUES
  ('Açúcar', 'ACUCAR', 'KG', 0),
  ('Garrafa PET', 'GARRAFA', 'UN', 0.50);

-- Cardápio de sucos da Cia do Suco. Cada suco aponta para a fruta/polpa que a produção desconta.
-- Laranja com beterraba usa a laranja como ingrediente principal (a beterraba ainda não entra no custo).
WITH frutas AS (
  INSERT INTO ingrediente (nome, tipo, unidade_medida) VALUES
    ('Polpa de Goiaba', 'POLPA', 'KG'),
    ('Polpa de Acerola', 'POLPA', 'KG'),
    ('Polpa de Abacaxi', 'POLPA', 'KG'),
    ('Polpa de Bacuri', 'POLPA', 'KG'),
    ('Polpa de Caju', 'POLPA', 'KG'),
    ('Polpa de Cupuaçu', 'POLPA', 'KG'),
    ('Polpa de Graviola', 'POLPA', 'KG'),
    ('Polpa de Murucí', 'POLPA', 'KG'),
    ('Polpa de Maracujá', 'POLPA', 'KG'),
    ('Laranja', 'POLPA', 'KG'),
    ('Limão', 'POLPA', 'KG'),
    ('Polpa de Taperebá', 'POLPA', 'KG'),
    ('Polpa de Manga', 'POLPA', 'KG')
  RETURNING id, nome
)
INSERT INTO produto (nome, categoria, ingrediente_id, preco_venda)
SELECT cardapio.nome, 'SUCO', frutas.id, cardapio.preco
FROM (VALUES
  ('Goiaba', 'Polpa de Goiaba', 9.00),
  ('Acerola', 'Polpa de Acerola', 10.00),
  ('Abacaxi', 'Polpa de Abacaxi', 12.00),
  ('Bacuri', 'Polpa de Bacuri', 28.00),
  ('Caju', 'Polpa de Caju', 10.00),
  ('Cupuaçu', 'Polpa de Cupuaçu', 15.00),
  ('Graviola', 'Polpa de Graviola', 15.00),
  ('Murucí', 'Polpa de Murucí', 13.00),
  ('Maracujá', 'Polpa de Maracujá', 11.00),
  ('Laranja', 'Laranja', 25.00),
  ('Limão', 'Limão', 10.00),
  ('Taperebá', 'Polpa de Taperebá', 13.00),
  ('Laranja com Beterraba', 'Laranja', 16.00),
  ('Manga', 'Polpa de Manga', 12.00)
) AS cardapio (nome, ingrediente, preco)
JOIN frutas ON frutas.nome = cardapio.ingrediente;
