from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.const.enums import TipoIngrediente, UnidadeMedida
from app.schemas.comum import DecimalJson


class IngredienteCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=100)
    tipo: TipoIngrediente
    unidade_medida: UnidadeMedida
    custo_unitario: Decimal = Field(default=Decimal(0), ge=0, max_digits=10, decimal_places=4)
    ativo: bool = True


class IngredienteUpdate(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=1, max_length=100)
    tipo: Optional[TipoIngrediente] = None
    unidade_medida: Optional[UnidadeMedida] = None
    custo_unitario: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=4)
    # Ajuste manual de estoque (perda, contagem). Compras devem usar entrada de estoque
    quantidade_estoque: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=3)
    ativo: Optional[bool] = None


class IngredienteResponse(BaseModel):
    id: UUID
    nome: str
    tipo: TipoIngrediente
    unidade_medida: UnidadeMedida
    quantidade_estoque: DecimalJson
    # Só para admin
    custo_unitario: Optional[DecimalJson] = None
    # Preço por unidade pago na compra mais recente (só para admin)
    ultimo_custo_compra: Optional[DecimalJson] = None
    ultima_compra_em: Optional[datetime] = None
    ativo: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
