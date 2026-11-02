from decimal import Decimal
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.const.enums import FormaPagamento
from app.schemas.comum import DecimalJson


class TaxaPagamentoUpdate(BaseModel):
    percentual: Optional[Decimal] = Field(default=None, ge=0, lt=100, max_digits=5, decimal_places=2)
    repassar_cliente: Optional[bool] = None


class TaxaPagamentoResponse(BaseModel):
    forma_pagamento: FormaPagamento
    percentual: DecimalJson
    repassar_cliente: bool
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
