from uuid import UUID, uuid4
from decimal import Decimal
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime
from sqlmodel import SQLModel, Field

from app.const.enums import FormaPagamento, OrigemPedido, StatusPedido, pg_enum
from app.validations.validar_horario import validar_horario


class Pedido(SQLModel, table=True):
    """Pedido de entrega (WhatsApp ou cadastrado pelo atendente). Só vira venda quando a entrega é confirmada."""
    __tablename__ = "pedido"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    cliente_id: UUID = Field(foreign_key="cliente.id", nullable=False)
    # Endereço usado nesta entrega
    endereco_id: Optional[UUID] = Field(default=None, foreign_key="endereco_cliente.id", nullable=True)
    origem: OrigemPedido = Field(sa_type=pg_enum(OrigemPedido, "origem_pedido"), nullable=False)
    status: StatusPedido = Field(
        default=StatusPedido.NOVO, sa_type=pg_enum(StatusPedido, "status_pedido"), nullable=False)
    # Opcional até a confirmação; fiado só pode ser escolhido pelo atendente
    forma_pagamento: Optional[FormaPagamento] = Field(
        default=None, sa_type=pg_enum(FormaPagamento, "forma_pagamento"), nullable=True)
    observacao: Optional[str] = Field(default=None, nullable=True)
    # Nulo quando o pedido veio do bot
    criado_por: Optional[UUID] = Field(default=None, foreign_key="usuario.id", nullable=True)
    # Funcionário que entregou (informado na confirmação)
    entregador_id: Optional[UUID] = Field(default=None, foreign_key="usuario.id", nullable=True)
    # Cobrada do cliente e repassada ao entregador: não é receita da loja
    taxa_entrega: Optional[Decimal] = Field(default=None, max_digits=10, decimal_places=2, nullable=True)
    venda_id: Optional[UUID] = Field(default=None, foreign_key="venda.id", nullable=True, unique=True)
    confirmado_por: Optional[UUID] = Field(default=None, foreign_key="usuario.id", nullable=True)
    motivo_cancelamento: Optional[str] = Field(default=None, nullable=True)
    cancelado_por: Optional[UUID] = Field(default=None, foreign_key="usuario.id", nullable=True)

    created_at: datetime = Field(
        default_factory=validar_horario, sa_type=DateTime(timezone=True), nullable=False)
    updated_at: datetime = Field(
        default_factory=validar_horario,
        sa_type=DateTime(timezone=True),
        nullable=False,
        sa_column_kwargs={"onupdate": validar_horario},
    )
    entregue_em: Optional[datetime] = Field(default=None, sa_type=DateTime(timezone=True), nullable=True)
    cancelado_em: Optional[datetime] = Field(default=None, sa_type=DateTime(timezone=True), nullable=True)


class ItemPedido(SQLModel, table=True):
    __tablename__ = "item_pedido"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    pedido_id: UUID = Field(foreign_key="pedido.id", nullable=False)
    produto_id: UUID = Field(foreign_key="produto.id", nullable=False)
    quantidade: int = Field(nullable=False)
