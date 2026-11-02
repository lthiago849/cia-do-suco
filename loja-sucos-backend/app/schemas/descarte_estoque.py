from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.comum import DecimalJson


class DescarteCreate(BaseModel):
    produto_id: Optional[UUID] = None
    ingrediente_id: Optional[UUID] = None
    quantidade: Decimal = Field(gt=0, max_digits=10, decimal_places=3)
    # Ex.: "estragou", "sujas demais, nem lavando saiu"
    motivo: str = Field(min_length=3)
    # Compra de onde vieram (opcional)
    entrada_estoque_id: Optional[UUID] = None

    @model_validator(mode="after")
    def validar_alvo(self):
        if (self.produto_id is None) == (self.ingrediente_id is None):
            raise ValueError("Informe produto_id ou ingrediente_id (apenas um).")
        if self.produto_id is not None and self.quantidade != self.quantidade.to_integral_value():
            raise ValueError("A quantidade de produto deve ser um número inteiro.")
        return self


class DescarteResponse(BaseModel):
    id: UUID
    produto_id: Optional[UUID] = None
    ingrediente_id: Optional[UUID] = None
    item_nome: str
    entrada_estoque_id: Optional[UUID] = None
    quantidade: DecimalJson
    # Só para admin
    valor_perdido: Optional[DecimalJson] = None
    motivo: str
    usuario_nome: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
