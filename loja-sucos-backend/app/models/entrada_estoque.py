from uuid import UUID, uuid4
from decimal import Decimal
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime
from sqlmodel import SQLModel, Field

from app.const.enums import CondicaoGarrafa, pg_enum
from app.validations.validar_horario import validar_horario


class EntradaEstoque(SQLModel, table=True):
    """Compra de um ingrediente ou de um produto pronto. Exatamente um dos dois ids é preenchido."""
    __tablename__ = "entrada_estoque"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    produto_id: Optional[UUID] = Field(default=None, foreign_key="produto.id", nullable=True)
    ingrediente_id: Optional[UUID] = Field(default=None, foreign_key="ingrediente.id", nullable=True)
    usuario_id: UUID = Field(foreign_key="usuario.id", nullable=False)
    quantidade: Decimal = Field(max_digits=10, decimal_places=3, nullable=False)
    custo_total: Decimal = Field(max_digits=10, decimal_places=2, nullable=False)
    # Só nas compras de garrafa
    condicao_garrafa: Optional[CondicaoGarrafa] = Field(
        default=None, sa_type=pg_enum(CondicaoGarrafa, "condicao_garrafa"), nullable=True)
    observacao: Optional[str] = Field(default=None, nullable=True)
    created_at: datetime = Field(
        default_factory=validar_horario, sa_type=DateTime(timezone=True), nullable=False)
