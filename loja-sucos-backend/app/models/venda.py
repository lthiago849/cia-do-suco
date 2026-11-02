from uuid import UUID, uuid4
from decimal import Decimal
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime
from sqlmodel import SQLModel, Field

from app.const.enums import FormaPagamento, pg_enum
from app.validations.validar_horario import validar_horario


class Venda(SQLModel, table=True):
    __tablename__ = "venda"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    # Funcionário que fez a venda
    usuario_id: UUID = Field(foreign_key="usuario.id", nullable=False)
    # Obrigatório quando a venda é fiado
    cliente_id: Optional[UUID] = Field(default=None, foreign_key="cliente.id", nullable=True)
    forma_pagamento: FormaPagamento = Field(sa_type=pg_enum(FormaPagamento, "forma_pagamento"), nullable=False)
    valor_total: Decimal = Field(max_digits=10, decimal_places=2, nullable=False)
    custo_total: Decimal = Field(max_digits=10, decimal_places=2, nullable=False)
    # Taxa de entrega cobrada junto (entregas). Repassada ao entregador: não entra no faturamento nem no lucro
    taxa_entrega: Decimal = Field(default=Decimal(0), max_digits=10, decimal_places=2, nullable=False)
    # Igual a valor_total + taxa_entrega nas vendas pagas na hora; no fiado cresce conforme os pagamentos
    valor_pago: Decimal = Field(default=Decimal(0), max_digits=10, decimal_places=2, nullable=False)
    # Acréscimo pago pelo cliente para cobrir a taxa do cartão
    # (valor passado na máquina = valor_total + taxa_entrega + acréscimo)
    acrescimo_pagamento: Decimal = Field(default=Decimal(0), max_digits=10, decimal_places=2, nullable=False)
    # Taxa da maquininha cobrada nesta venda (zero no fiado; lá a taxa vem no pagamento)
    taxa_pagamento: Decimal = Field(default=Decimal(0), max_digits=10, decimal_places=2, nullable=False)
    observacao: Optional[str] = Field(default=None, nullable=True)
    data_venda: datetime = Field(
        default_factory=validar_horario, sa_type=DateTime(timezone=True), nullable=False)
    cancelada_em: Optional[datetime] = Field(default=None, sa_type=DateTime(timezone=True), nullable=True)
    cancelada_por: Optional[UUID] = Field(default=None, foreign_key="usuario.id", nullable=True)

    created_at: datetime = Field(
        default_factory=validar_horario, sa_type=DateTime(timezone=True), nullable=False)
    updated_at: datetime = Field(
        default_factory=validar_horario,
        sa_type=DateTime(timezone=True),
        nullable=False,
        sa_column_kwargs={"onupdate": validar_horario},
    )
