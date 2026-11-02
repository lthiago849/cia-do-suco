from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.const.enums import CategoriaProduto
from app.schemas.comum import DecimalJson


class ProdutoCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=100)
    categoria: CategoriaProduto
    # Polpa usada na produção (somente sucos)
    ingrediente_id: Optional[UUID] = None
    preco_venda: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    # Para produtos comprados prontos; os produzidos têm o custo calculado pela produção
    custo_unitario: Decimal = Field(default=Decimal(0), ge=0, max_digits=10, decimal_places=4)
    descricao: Optional[str] = None
    ativo: bool = True


class ProdutoUpdate(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=1, max_length=100)
    categoria: Optional[CategoriaProduto] = None
    ingrediente_id: Optional[UUID] = None
    preco_venda: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    custo_unitario: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=4)
    # Ajuste manual de estoque (perda, contagem). Compras e produção têm rotas próprias
    quantidade_estoque: Optional[int] = Field(default=None, ge=0)
    descricao: Optional[str] = None
    ativo: Optional[bool] = None
    # Com custo_unitario: grava esse custo também nas vendas deste produto que ficaram com custo zero
    # (estoque lançado à mão, sem produção), para o lucro do painel ficar certo
    aplicar_custo_vendas_sem_custo: bool = False


class ProdutoResponse(BaseModel):
    id: UUID
    nome: str
    categoria: CategoriaProduto
    ingrediente_id: Optional[UUID] = None
    ingrediente_nome: Optional[str] = None
    preco_venda: DecimalJson
    # Só para admin
    custo_unitario: Optional[DecimalJson] = None
    # Só para admin: unidades vendidas com custo zero (o lucro delas aparece inflado no painel)
    vendidos_sem_custo: Optional[int] = None
    # Só para admin: custo de cada unidade na produção mais recente (sem misturar com o estoque anterior)
    custo_ultima_producao: Optional[DecimalJson] = None
    quantidade_estoque: int
    descricao: Optional[str] = None
    ativo: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
