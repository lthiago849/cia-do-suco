from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.const.enums import CondicaoGarrafa
from app.schemas.comum import DecimalJson


class EntradaEstoqueCreate(BaseModel):
    produto_id: Optional[UUID] = None
    ingrediente_id: Optional[UUID] = None
    quantidade: Decimal = Field(gt=0, max_digits=10, decimal_places=3)
    # Quanto foi pago pela compra inteira
    custo_total: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    # Obrigatório nas compras de garrafa
    condicao_garrafa: Optional[CondicaoGarrafa] = None
    observacao: Optional[str] = None

    @model_validator(mode="after")
    def validar_alvo(self):
        if (self.produto_id is None) == (self.ingrediente_id is None):
            raise ValueError("Informe produto_id ou ingrediente_id (apenas um).")
        if self.produto_id is not None and self.quantidade != self.quantidade.to_integral_value():
            raise ValueError("A quantidade de produto deve ser um número inteiro.")
        return self


class EntradaEstoqueResponse(BaseModel):
    id: UUID
    produto_id: Optional[UUID] = None
    ingrediente_id: Optional[UUID] = None
    item_nome: str
    usuario_nome: str
    quantidade: DecimalJson
    # Só para admin
    custo_total: Optional[DecimalJson] = None
    condicao_garrafa: Optional[CondicaoGarrafa] = None
    # Quanto desta compra já foi descartado
    quantidade_descartada: DecimalJson = Decimal(0)
    observacao: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
