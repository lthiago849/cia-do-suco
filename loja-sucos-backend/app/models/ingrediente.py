from uuid import UUID, uuid4
from decimal import Decimal
from datetime import datetime

from sqlalchemy import DateTime
from sqlmodel import SQLModel, Field

from app.const.enums import TipoIngrediente, UnidadeMedida, pg_enum
from app.validations.validar_horario import validar_horario


class Ingrediente(SQLModel, table=True):
    __tablename__ = "ingrediente"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    nome: str = Field(max_length=100, nullable=False, unique=True)
    tipo: TipoIngrediente = Field(sa_type=pg_enum(TipoIngrediente, "tipo_ingrediente"), nullable=False)
    unidade_medida: UnidadeMedida = Field(sa_type=pg_enum(UnidadeMedida, "unidade_medida"), nullable=False)
    quantidade_estoque: Decimal = Field(default=Decimal(0), max_digits=10, decimal_places=3, nullable=False)
    custo_unitario: Decimal = Field(default=Decimal(0), max_digits=10, decimal_places=4, nullable=False)
    ativo: bool = Field(default=True, nullable=False)

    created_at: datetime = Field(
        default_factory=validar_horario, sa_type=DateTime(timezone=True), nullable=False)
    updated_at: datetime = Field(
        default_factory=validar_horario,
        sa_type=DateTime(timezone=True),
        nullable=False,
        sa_column_kwargs={"onupdate": validar_horario},
    )
