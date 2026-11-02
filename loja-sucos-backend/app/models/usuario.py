from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime
from sqlmodel import SQLModel, Field

from app.const.enums import TipoUsuario, pg_enum
from app.validations.validar_horario import validar_horario


class Usuario(SQLModel, table=True):
    __tablename__ = "usuario"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    nome_usuario: str = Field(max_length=255, nullable=False, unique=True)
    nome: str = Field(max_length=255, nullable=False)
    email: str = Field(max_length=255, nullable=False, unique=True)
    senha: str = Field(max_length=255, nullable=False)
    tipo: TipoUsuario = Field(sa_type=pg_enum(TipoUsuario, "tipo_usuario"), nullable=False)
    # Somente dígitos com DDI, como o do cliente
    telefone: Optional[str] = Field(default=None, max_length=20, nullable=True, unique=True)
    # Recebe por e-mail o relatório diário de estoque das 8h
    recebe_relatorio: bool = Field(default=True, nullable=False)
    ativo: bool = Field(default=True, nullable=False)

    created_at: datetime = Field(
        default_factory=validar_horario, sa_type=DateTime(timezone=True), nullable=False)
    updated_at: datetime = Field(
        default_factory=validar_horario,
        sa_type=DateTime(timezone=True),
        nullable=False,
        sa_column_kwargs={"onupdate": validar_horario},
    )
