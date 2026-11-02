from uuid import UUID, uuid4
from decimal import Decimal
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime
from sqlmodel import SQLModel, Field

from app.const.enums import FormaPagamento, pg_enum
from app.validations.validar_horario import validar_horario


class PagamentoFiado(SQLModel, table=True):
    __tablename__ = "pagamento_fiado"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    cliente_id: UUID = Field(foreign_key="cliente.id", nullable=False)
    # Funcionário que recebeu o pagamento
    usuario_id: UUID = Field(foreign_key="usuario.id", nullable=False)
    valor: Decimal = Field(max_digits=10, decimal_places=2, nullable=False)
    forma_pagamento: FormaPagamento = Field(sa_type=pg_enum(FormaPagamento, "forma_pagamento"), nullable=False)
    # Acréscimo pago pelo cliente para cobrir a taxa do cartão
    acrescimo_pagamento: Decimal = Field(default=Decimal(0), max_digits=10, decimal_places=2, nullable=False)
    # Taxa da maquininha quando o fiado é pago no cartão
    taxa_pagamento: Decimal = Field(default=Decimal(0), max_digits=10, decimal_places=2, nullable=False)
    observacao: Optional[str] = Field(default=None, nullable=True)
    pago_em: datetime = Field(
        default_factory=validar_horario, sa_type=DateTime(timezone=True), nullable=False)
