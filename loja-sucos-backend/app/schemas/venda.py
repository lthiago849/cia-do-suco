from uuid import UUID
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.const.enums import CategoriaProduto, FormaPagamento
from app.schemas.comum import DecimalJson


class ItemVendaCreate(BaseModel):
    produto_id: UUID
    quantidade: int = Field(gt=0)


class VendaCreate(BaseModel):
    """O total é calculado no servidor a partir dos preços cadastrados."""
    itens: list[ItemVendaCreate] = Field(min_length=1)
    forma_pagamento: FormaPagamento
    cliente_id: Optional[UUID] = None
    observacao: Optional[str] = None

    @model_validator(mode="after")
    def validar_fiado(self):
        if self.forma_pagamento == FormaPagamento.FIADO and self.cliente_id is None:
            raise ValueError("Venda fiado precisa de um cliente.")
        return self


class ItemVendaResponse(BaseModel):
    produto_id: UUID
    produto_nome: str
    categoria: CategoriaProduto
    quantidade: int
    preco_unitario: DecimalJson
    # Só para admin
    custo_unitario: Optional[DecimalJson] = None
    subtotal: DecimalJson


class VendaResponse(BaseModel):
    id: UUID
    data_venda: datetime
    forma_pagamento: FormaPagamento
    valor_total: DecimalJson
    valor_pago: DecimalJson
    # Taxa de entrega cobrada junto nas entregas (vai para o entregador; não é faturamento)
    taxa_entrega: DecimalJson = 0
    # Pago pelo cliente para cobrir a taxa do cartão: na máquina passa valor_total + taxa_entrega + acréscimo
    acrescimo_pagamento: DecimalJson
    # Só para admin
    custo_total: Optional[DecimalJson] = None
    taxa_pagamento: Optional[DecimalJson] = None
    usuario_id: UUID
    usuario_nome: str
    cliente_id: Optional[UUID] = None
    cliente_nome: Optional[str] = None
    observacao: Optional[str] = None
    cancelada_em: Optional[datetime] = None
    itens: list[ItemVendaResponse]

    model_config = ConfigDict(from_attributes=True)
