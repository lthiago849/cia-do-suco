from uuid import UUID, uuid4
from decimal import Decimal
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime
from sqlmodel import SQLModel, Field

from app.validations.validar_horario import validar_horario


class EnderecoCliente(SQLModel, table=True):
    """Cada cliente tem no máximo um endereço ativo; os anteriores ficam como histórico."""
    __tablename__ = "endereco_cliente"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    cliente_id: UUID = Field(foreign_key="cliente.id", nullable=False)
    logradouro: Optional[str] = Field(default=None, max_length=255, nullable=True)
    numero: Optional[str] = Field(default=None, max_length=20, nullable=True)
    bairro: Optional[str] = Field(default=None, max_length=100, nullable=True)
    complemento: Optional[str] = Field(default=None, max_length=255, nullable=True)
    ponto_referencia: Optional[str] = Field(default=None, nullable=True)
    latitude: Optional[Decimal] = Field(default=None, max_digits=9, decimal_places=6, nullable=True)
    longitude: Optional[Decimal] = Field(default=None, max_digits=9, decimal_places=6, nullable=True)
    ativo: bool = Field(default=True, nullable=False)
    confirmado_em: Optional[datetime] = Field(default=None, sa_type=DateTime(timezone=True), nullable=True)

    created_at: datetime = Field(
        default_factory=validar_horario, sa_type=DateTime(timezone=True), nullable=False)
    updated_at: datetime = Field(
        default_factory=validar_horario,
        sa_type=DateTime(timezone=True),
        nullable=False,
        sa_column_kwargs={"onupdate": validar_horario},
    )
