from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.const.enums import CategoriaProduto, FormaPagamento, OrigemPedido, StatusPedido
from app.schemas.cliente import EnderecoResponse
from app.schemas.comum import DecimalJson
from app.schemas.venda import ItemVendaCreate


class PedidoCreate(BaseModel):
    """Pedido cadastrado pelo atendente (o bot do WhatsApp vai usar o mesmo formato)"""
    cliente_id: UUID
    itens: list[ItemVendaCreate] = Field(min_length=1)
    # Sem endereço informado, usa o endereço atual do cliente
    endereco_id: Optional[UUID] = None
    forma_pagamento: Optional[FormaPagamento] = None
    observacao: Optional[str] = None


class PedidoUpdate(BaseModel):
    """Revisão do pedido pelo atendente, antes da entrega"""
    itens: Optional[list[ItemVendaCreate]] = Field(default=None, min_length=1)
    endereco_id: Optional[UUID] = None
    forma_pagamento: Optional[FormaPagamento] = None
    observacao: Optional[str] = None


class EntregaPedido(BaseModel):
    # Funcionário que levou o pedido
    entregador_id: UUID
    # Fica com o entregador; não entra no faturamento da loja
    taxa_entrega: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    forma_pagamento: FormaPagamento


class CancelamentoPedido(BaseModel):
    motivo: str = Field(min_length=3)


class ItemPedidoResponse(BaseModel):
    produto_id: UUID
    produto_nome: str
    categoria: CategoriaProduto
    quantidade: int
    # Preço atual do produto; depois da entrega, o preço registrado na venda
    preco_unitario: DecimalJson
    subtotal: DecimalJson
    estoque_disponivel: int


class PedidoResponse(BaseModel):
    id: UUID
    origem: OrigemPedido
    status: StatusPedido
    cliente_id: UUID
    cliente_nome: str
    cliente_telefone: Optional[str] = None
    endereco: Optional[EnderecoResponse] = None
    itens: list[ItemPedidoResponse]
    total_produtos: DecimalJson
    forma_pagamento: Optional[FormaPagamento] = None
    observacao: Optional[str] = None
    taxa_entrega: Optional[DecimalJson] = None
    entregador_id: Optional[UUID] = None
    entregador_nome: Optional[str] = None
    criado_por_nome: Optional[str] = None
    confirmado_por_nome: Optional[str] = None
    cancelado_por_nome: Optional[str] = None
    motivo_cancelamento: Optional[str] = None
    venda_id: Optional[UUID] = None
    created_at: datetime
    entregue_em: Optional[datetime] = None
    cancelado_em: Optional[datetime] = None


class EntregadorResumo(BaseModel):
    """Entregas confirmadas de cada entregador no período e quanto ele recebeu de taxa"""
    entregador_id: UUID
    nome: str
    entregas: int
    total_taxas: DecimalJson
