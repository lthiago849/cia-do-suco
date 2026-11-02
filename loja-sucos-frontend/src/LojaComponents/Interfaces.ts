export type TipoUsuario = "ADMIN" | "ATENDENTE";
export type CategoriaProduto = "SUCO" | "PICOLE" | "MORENINHA" | "CREMOSINHO";
export type TipoIngrediente = "POLPA" | "FRUTA" | "ACUCAR" | "GARRAFA" | "OUTRO";
export type UnidadeMedida = "KG" | "L" | "UN";
export type CondicaoGarrafa = "LIMPA" | "SUJA";
export type FormaPagamento = "PIX" | "DINHEIRO" | "DEBITO" | "CREDITO" | "FIADO";

export interface Usuario {
  id: string;
  nome_usuario: string;
  nome: string;
  email: string;
  tipo: TipoUsuario;
  telefone: string | null;
  recebe_relatorio: boolean;
  ativo: boolean;
  created_at?: string;
}

export interface Produto {
  id: string;
  nome: string;
  categoria: CategoriaProduto;
  ingrediente_id: string | null;
  ingrediente_nome: string | null;
  preco_venda: number;
  custo_unitario: number | null;
  /** Só para admin: unidades vendidas com custo zero (lucro inflado no painel) */
  vendidos_sem_custo?: number | null;
  quantidade_estoque: number;
  descricao: string | null;
  ativo: boolean;
}

export interface Ingrediente {
  id: string;
  nome: string;
  tipo: TipoIngrediente;
  unidade_medida: UnidadeMedida;
  quantidade_estoque: number;
  custo_unitario: number | null;
  /** Preço por unidade pago na compra mais recente (só admin) */
  ultimo_custo_compra?: number | null;
  ultima_compra_em?: string | null;
  ativo: boolean;
}

export interface EntradaEstoque {
  id: string;
  produto_id: string | null;
  ingrediente_id: string | null;
  item_nome: string;
  usuario_nome: string;
  quantidade: number;
  custo_total: number | null;
  condicao_garrafa: CondicaoGarrafa | null;
  quantidade_descartada: number;
  observacao: string | null;
  created_at: string;
}

export interface Descarte {
  id: string;
  produto_id: string | null;
  ingrediente_id: string | null;
  item_nome: string;
  entrada_estoque_id: string | null;
  quantidade: number;
  valor_perdido: number | null;
  motivo: string;
  usuario_nome: string;
  created_at: string;
}

export interface Producao {
  id: string;
  produto_id: string;
  produto_nome: string;
  usuario_nome: string;
  quantidade_produzida: number;
  polpa_usada: number;
  acucar_usado: number;
  garrafas_usadas: number;
  custo_total: number | null;
  produzido_em: string;
}

export interface Endereco {
  id: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  ponto_referencia: string | null;
  latitude: number | null;
  longitude: number | null;
  ativo: boolean;
  confirmado_em: string | null;
  created_at: string;
}

export type EnderecoForm = Omit<Endereco, "id" | "ativo" | "confirmado_em" | "created_at">;

export interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  observacao: string | null;
  ativo: boolean;
  created_at: string;
  endereco_atual: Endereco | null;
  saldo_fiado: number;
}

export interface ItemVenda {
  produto_id: string;
  produto_nome: string;
  categoria: CategoriaProduto;
  quantidade: number;
  preco_unitario: number;
  custo_unitario: number | null;
  subtotal: number;
}

export interface Venda {
  id: string;
  data_venda: string;
  forma_pagamento: FormaPagamento;
  valor_total: number;
  valor_pago: number;
  /** Taxa de entrega cobrada junto nas entregas (repassada ao entregador, não é faturamento) */
  taxa_entrega: number;
  acrescimo_pagamento: number;
  custo_total: number | null;
  taxa_pagamento: number | null;
  usuario_id: string;
  usuario_nome: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  observacao: string | null;
  cancelada_em: string | null;
  cancelada_por_nome?: string | null;
  motivo_cancelamento?: string | null;
  itens: ItemVenda[];
}

export interface PagamentoFiado {
  id: string;
  cliente_id: string;
  valor: number;
  forma_pagamento: FormaPagamento;
  acrescimo_pagamento: number;
  taxa_pagamento: number | null;
  usuario_nome: string;
  observacao: string | null;
  pago_em: string;
}

export interface Devedor {
  cliente_id: string;
  nome: string;
  telefone: string | null;
  saldo: number;
  vendas_em_aberto: number;
  divida_desde: string;
  dias_em_aberto: number;
}

export interface ExtratoFiado {
  cliente: Cliente;
  saldo: number;
  vendas: Venda[];
  pagamentos: PagamentoFiado[];
}

export interface ResumoRelatorio {
  faturamento: number;
  custo: number;
  taxas: number;
  acrescimos: number;
  lucro: number;
  num_vendas: number;
  ticket_medio: number;
  fiado_vendido_periodo: number;
  fiado_em_aberto_total: number;
  por_forma_pagamento: {
    forma_pagamento: FormaPagamento;
    total: number;
    quantidade: number;
    percentual: number;
    taxas: number;
  }[];
}

export interface ProdutoRelatorio {
  produto_id: string;
  nome: string;
  categoria: CategoriaProduto;
  quantidade: number;
  receita: number;
  custo: number;
  taxas: number;
  lucro: number;
  margem: number;
}

export interface VendaPorDia {
  dia: string;
  faturamento: number;
  lucro: number;
  num_vendas: number;
}

export interface VendaPorDiaSemana {
  dia_semana: number;
  nome: string;
  faturamento: number;
  num_vendas: number;
  dias_com_venda: number;
  media_faturamento: number;
}

export interface HorarioPico {
  dia_semana: number;
  hora: number;
  num_vendas: number;
  faturamento: number;
}

export interface Periodo {
  data_inicio: string;
  data_fim: string;
}

export interface TaxaPagamento {
  forma_pagamento: Exclude<FormaPagamento, "FIADO">;
  percentual: number;
  repassar_cliente: boolean;
  updated_at: string;
}

export interface RelatorioEstoque {
  assunto: string;
  mensagem: string;
  html: string;
  destinatarios: { nome: string; email: string }[];
  email_configurado: boolean;
  hora_envio: number;
  ultimo_envio: {
    data: string;
    enviado_em: string | null;
    destinatarios: number;
    erro: string | null;
  } | null;
}

export type StatusPedido = "NOVO" | "ENTREGUE" | "CANCELADO";

export interface ItemPedido {
  produto_id: string;
  produto_nome: string;
  categoria: CategoriaProduto;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  estoque_disponivel: number;
}

export interface Pedido {
  id: string;
  origem: "WHATSAPP" | "ATENDENTE";
  status: StatusPedido;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  endereco: Endereco | null;
  itens: ItemPedido[];
  total_produtos: number;
  forma_pagamento: FormaPagamento | null;
  observacao: string | null;
  taxa_entrega: number | null;
  entregador_id: string | null;
  entregador_nome: string | null;
  criado_por_nome: string | null;
  confirmado_por_nome: string | null;
  cancelado_por_nome: string | null;
  motivo_cancelamento: string | null;
  venda_id: string | null;
  created_at: string;
  entregue_em: string | null;
  cancelado_em: string | null;
}

export interface EntregadorResumo {
  entregador_id: string;
  nome: string;
  entregas: number;
  total_taxas: number;
}

export interface MembroEquipe {
  id: string;
  nome: string;
}
