from uuid import UUID, uuid4
from decimal import Decimal
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime
from sqlmodel import SQLModel, Field

from app.validations.validar_horario import validar_horario


class DescarteEstoque(SQLModel, table=True):
    """Ingrediente ou produto jogado fora (garrafas sujas demais, suco que estragou...). Exatamente um dos dois
    ids é preenchido. O custo do descartado é repassado para o que sobrou no estoque; valor_perdido registra
    quanto foi."""
    __tablename__ = "descarte_estoque"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    produto_id: Optional[UUID] = Field(default=None, foreign_key="produto.id", nullable=True)
    ingrediente_id: Optional[UUID] = Field(default=None, foreign_key="ingrediente.id", nullable=True)
    # Compra de onde vieram os itens descartados (opcional)
    entrada_estoque_id: Optional[UUID] = Field(default=None, foreign_key="entrada_estoque.id", nullable=True)
    usuario_id: UUID = Field(foreign_key="usuario.id", nullable=False)
    quantidade: Decimal = Field(max_digits=10, decimal_places=3, nullable=False)
    valor_perdido: Decimal = Field(max_digits=10, decimal_places=2, nullable=False)
    motivo: str = Field(nullable=False)
    created_at: datetime = Field(
        default_factory=validar_horario, sa_type=DateTime(timezone=True), nullable=False)
