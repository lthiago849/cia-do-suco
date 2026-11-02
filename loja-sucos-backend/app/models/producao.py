from uuid import UUID, uuid4
from decimal import Decimal
from datetime import datetime

from sqlalchemy import DateTime
from sqlmodel import SQLModel, Field

from app.validations.validar_horario import validar_horario


class Producao(SQLModel, table=True):
    __tablename__ = "producao"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    produto_id: UUID = Field(foreign_key="produto.id", nullable=False)
    usuario_id: UUID = Field(foreign_key="usuario.id", nullable=False)
    quantidade_produzida: int = Field(nullable=False)
    polpa_usada: Decimal = Field(max_digits=10, decimal_places=3, nullable=False)
    acucar_usado: Decimal = Field(max_digits=10, decimal_places=3, nullable=False)
    # Uma garrafa PET por unidade produzida
    garrafas_usadas: int = Field(default=0, nullable=False)
    custo_total: Decimal = Field(max_digits=10, decimal_places=2, nullable=False)
    produzido_em: datetime = Field(
        default_factory=validar_horario, sa_type=DateTime(timezone=True), nullable=False)
