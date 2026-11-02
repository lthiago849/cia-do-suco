from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.const.enums import FormaPagamento
from app.schemas.comum import DecimalJson
from app.schemas.cliente import ClienteResponse
from app.schemas.venda import VendaResponse


class PagamentoFiadoCreate(BaseModel):
    cliente_id: UUID
    valor: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    forma_pagamento: FormaPagamento
    observacao: Optional[str] = None

    @field_validator("forma_pagamento")
    def validar_forma(cls, forma):
        if forma == FormaPagamento.FIADO:
            raise ValueError("Pagamento de fiado não pode ser feito com fiado.")
        return forma


class PagamentoFiadoResponse(BaseModel):
    id: UUID
    cliente_id: UUID
    valor: DecimalJson
    forma_pagamento: FormaPagamento
    acrescimo_pagamento: DecimalJson
    # Só para admin
    taxa_pagamento: Optional[DecimalJson] = None
    usuario_id: UUID
    usuario_nome: str
    observacao: Optional[str] = None
    pago_em: datetime

    model_config = ConfigDict(from_attributes=True)


class DevedorResponse(BaseModel):
    cliente_id: UUID
    nome: str
    telefone: Optional[str] = None
    saldo: DecimalJson
    vendas_em_aberto: int
    divida_desde: datetime
    dias_em_aberto: int


class ExtratoFiadoResponse(BaseModel):
    cliente: ClienteResponse
    saldo: DecimalJson
    vendas: list[VendaResponse]
    pagamentos: list[PagamentoFiadoResponse]
