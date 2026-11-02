from datetime import date, datetime
from typing import Optional

from sqlalchemy import DateTime
from sqlmodel import SQLModel, Field

from app.validations.validar_horario import validar_horario


class EnvioRelatorio(SQLModel, table=True):
    """Envio automático do relatório de estoque, um por dia"""
    __tablename__ = "envio_relatorio"

    data: date = Field(primary_key=True)
    enviado_em: Optional[datetime] = Field(default=None, sa_type=DateTime(timezone=True), nullable=True)
    destinatarios: int = Field(default=0, nullable=False)
    erro: Optional[str] = Field(default=None, nullable=True)
    created_at: datetime = Field(
        default_factory=validar_horario, sa_type=DateTime(timezone=True), nullable=False)
