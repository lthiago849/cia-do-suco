from uuid import UUID, uuid4
from decimal import Decimal
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime
from sqlmodel import SQLModel, Field

from app.const.enums import CategoriaProduto, pg_enum
from app.validations.validar_horario import validar_horario


class Produto(SQLModel, table=True):
    __tablename__ = "produto"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    nome: str = Field(max_length=100, nullable=False)
    categoria: CategoriaProduto = Field(sa_type=pg_enum(CategoriaProduto, "categoria_produto"), nullable=False)
    # Polpa consumida na produção. Nulo para produtos comprados prontos (picolé, moreninha, cremosinho)
    ingrediente_id: Optional[UUID] = Field(default=None, foreign_key="ingrediente.id", nullable=True)
    preco_venda: Decimal = Field(max_digits=10, decimal_places=2, nullable=False)
    custo_unitario: Decimal = Field(default=Decimal(0), max_digits=10, decimal_places=4, nullable=False)
    quantidade_estoque: int = Field(default=0, nullable=False)
    descricao: Optional[str] = Field(default=None, nullable=True)
    ativo: bool = Field(default=True, nullable=False)

    created_at: datetime = Field(
        default_factory=validar_horario, sa_type=DateTime(timezone=True), nullable=False)
    updated_at: datetime = Field(
        default_factory=validar_horario,
        sa_type=DateTime(timezone=True),
        nullable=False,
        sa_column_kwargs={"onupdate": validar_horario},
    )
