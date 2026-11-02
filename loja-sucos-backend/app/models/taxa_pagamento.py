from decimal import Decimal
from datetime import datetime

from sqlalchemy import DateTime
from sqlmodel import SQLModel, Field

from app.const.enums import FormaPagamento, pg_enum
from app.validations.validar_horario import validar_horario


class TaxaPagamento(SQLModel, table=True):
    """Percentual cobrado pela maquininha/banco em cada forma de pagamento (não existe para FIADO)."""
    __tablename__ = "taxa_pagamento"

    forma_pagamento: FormaPagamento = Field(
        sa_type=pg_enum(FormaPagamento, "forma_pagamento"), primary_key=True)
    percentual: Decimal = Field(default=Decimal(0), max_digits=5, decimal_places=2, nullable=False)
    # O cliente paga a taxa: valor passado na máquina = total + acréscimo
    repassar_cliente: bool = Field(default=True, nullable=False)
    updated_at: datetime = Field(
        default_factory=validar_horario,
        sa_type=DateTime(timezone=True),
        nullable=False,
        sa_column_kwargs={"onupdate": validar_horario},
    )
