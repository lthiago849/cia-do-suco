from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime
from sqlmodel import SQLModel, Field

from app.validations.validar_horario import validar_horario


class Cliente(SQLModel, table=True):
    __tablename__ = "cliente"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    nome: str = Field(max_length=255, nullable=False)
    # Somente dígitos com DDI. Identifica o cliente quando ele chama no WhatsApp
    telefone: Optional[str] = Field(default=None, max_length=20, nullable=True, unique=True)
    observacao: Optional[str] = Field(default=None, nullable=True)
    ativo: bool = Field(default=True, nullable=False)

    created_at: datetime = Field(
        default_factory=validar_horario, sa_type=DateTime(timezone=True), nullable=False)
    updated_at: datetime = Field(
        default_factory=validar_horario,
        sa_type=DateTime(timezone=True),
        nullable=False,
        sa_column_kwargs={"onupdate": validar_horario},
    )
