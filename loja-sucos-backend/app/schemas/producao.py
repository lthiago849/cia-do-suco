from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.comum import DecimalJson


class ProducaoCreate(BaseModel):
    produto_id: UUID
    quantidade_produzida: int = Field(gt=0)
    polpa_usada: Decimal = Field(ge=0, max_digits=10, decimal_places=3)
    acucar_usado: Decimal = Field(ge=0, max_digits=10, decimal_places=3)


class ProducaoResponse(BaseModel):
    id: UUID
    produto_id: UUID
    produto_nome: str
    usuario_id: UUID
    usuario_nome: str
    quantidade_produzida: int
    polpa_usada: DecimalJson
    acucar_usado: DecimalJson
    garrafas_usadas: int
    # Só para admin
    custo_total: Optional[DecimalJson] = None
    produzido_em: datetime

    model_config = ConfigDict(from_attributes=True)
