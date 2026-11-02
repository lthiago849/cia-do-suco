from decimal import Decimal

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.const.enums import FormaPagamento
from app.exceptions.db import instancia_nao_encontrada
from app.exceptions.genericos import regra_de_negocio
from app.models.taxa_pagamento import TaxaPagamento
from app.schemas.taxa_pagamento import TaxaPagamentoUpdate, TaxaPagamentoResponse
from app.utils.estoque import calcular_cobranca


async def listar_taxas(db: AsyncSession) -> list[TaxaPagamentoResponse]:
    result = await db.exec(select(TaxaPagamento).order_by(TaxaPagamento.forma_pagamento))
    return [TaxaPagamentoResponse.model_validate(t) for t in result.all()]


async def atualizar_taxa(db: AsyncSession, forma_pagamento: FormaPagamento,
                         taxa_update: TaxaPagamentoUpdate) -> TaxaPagamentoResponse:
    if forma_pagamento == FormaPagamento.FIADO:
        regra_de_negocio("Fiado não tem taxa própria: ela é cobrada na forma usada para pagar o fiado.")
    taxa = await db.get(TaxaPagamento, forma_pagamento)
    if not taxa:
        instancia_nao_encontrada("Taxa dessa forma de pagamento")

    if taxa_update.percentual is not None:
        taxa.percentual = taxa_update.percentual
    if taxa_update.repassar_cliente is not None:
        taxa.repassar_cliente = taxa_update.repassar_cliente
    db.add(taxa)
    await db.commit()
    await db.refresh(taxa)
    return TaxaPagamentoResponse.model_validate(taxa)


async def calcular_taxa(db: AsyncSession, forma_pagamento: FormaPagamento, valor: Decimal) -> tuple[Decimal, Decimal]:
    """(acréscimo pago pelo cliente, taxa da maquininha) sobre <valor>. Fiado não tem taxa na venda: ela é
    cobrada quando o fiado é pago."""
    if forma_pagamento == FormaPagamento.FIADO:
        return Decimal(0), Decimal(0)
    taxa = await db.get(TaxaPagamento, forma_pagamento)
    if not taxa:
        return Decimal(0), Decimal(0)
    return calcular_cobranca(valor, taxa.percentual, taxa.repassar_cliente)
