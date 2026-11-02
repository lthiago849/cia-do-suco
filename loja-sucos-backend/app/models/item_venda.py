from uuid import UUID, uuid4
from decimal import Decimal

from sqlmodel import SQLModel, Field


class ItemVenda(SQLModel, table=True):
    __tablename__ = "item_venda"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    venda_id: UUID = Field(foreign_key="venda.id", nullable=False)
    produto_id: UUID = Field(foreign_key="produto.id", nullable=False)
    quantidade: int = Field(nullable=False)
    # Cópias do momento da venda: mudar o preço depois não altera o histórico nem o lucro
    preco_unitario: Decimal = Field(max_digits=10, decimal_places=2, nullable=False)
    custo_unitario: Decimal = Field(max_digits=10, decimal_places=4, nullable=False)
