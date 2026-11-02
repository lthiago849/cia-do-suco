from uuid import UUID
from decimal import Decimal

from sqlalchemy import func
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.const.enums import FormaPagamento
from app.controllers.cliente import get_cliente_by_id
from app.controllers.taxa_pagamento import calcular_taxa
from app.controllers.venda import listar_vendas
from app.exceptions.db import instancia_nao_encontrada
from app.exceptions.genericos import regra_de_negocio
from app.models.cliente import Cliente
from app.models.pagamento_fiado import PagamentoFiado
from app.models.usuario import Usuario
from app.models.venda import Venda
from app.schemas.fiado import (
    PagamentoFiadoCreate, PagamentoFiadoResponse, DevedorResponse, ExtratoFiadoResponse
)
from app.utils.estoque import distribuir_fifo
from app.utils.fiado import condicao_fiado_aberto, saldo_venda
from app.validations.validar_horario import validar_horario


def query_pagamentos():
    return (
        select(PagamentoFiado, Usuario.nome.label("usuario_nome"))
        .join(Usuario, PagamentoFiado.usuario_id == Usuario.id)
    )


def montar_pagamento_response(pagamento: PagamentoFiado, usuario_nome: str) -> PagamentoFiadoResponse:
    return PagamentoFiadoResponse.model_validate({**pagamento.model_dump(), "usuario_nome": usuario_nome})


async def listar_devedores(db: AsyncSession) -> list[DevedorResponse]:
    saldo = func.sum(saldo_venda())
    result = await db.exec(
        select(Cliente.id, Cliente.nome, Cliente.telefone, saldo, func.count(Venda.id), func.min(Venda.data_venda))
        .join(Venda, Venda.cliente_id == Cliente.id)
        .where(condicao_fiado_aberto())
        .group_by(Cliente.id)
        .order_by(saldo.desc())
    )

    agora = validar_horario()
    return [
        DevedorResponse(
            cliente_id=cliente_id,
            nome=nome,
            telefone=telefone,
            saldo=saldo_cliente,
            vendas_em_aberto=vendas_em_aberto,
            divida_desde=divida_desde,
            dias_em_aberto=(agora - divida_desde).days,
        )
        for cliente_id, nome, telefone, saldo_cliente, vendas_em_aberto, divida_desde in result.all()
    ]


async def get_extrato(db: AsyncSession, id_cliente: UUID) -> ExtratoFiadoResponse:
    """Todas as compras fiado do cliente (quem vendeu, quando, quais produtos) e todos os pagamentos"""
    cliente = await get_cliente_by_id(db, id_cliente)
    vendas = await listar_vendas(db, cliente_id=id_cliente, forma_pagamento=FormaPagamento.FIADO, limit=1000)

    result = await db.exec(
        query_pagamentos()
        .where(PagamentoFiado.cliente_id == id_cliente)
        .order_by(col(PagamentoFiado.pago_em).desc())
    )
    pagamentos = [montar_pagamento_response(*linha) for linha in result.all()]

    return ExtratoFiadoResponse(cliente=cliente, saldo=cliente.saldo_fiado, vendas=vendas, pagamentos=pagamentos)


async def registrar_pagamento(db: AsyncSession, pagamento_create: PagamentoFiadoCreate,
                              usuario_id: UUID) -> PagamentoFiadoResponse:
    """Abate o valor pago das vendas fiado em aberto, da mais antiga para a mais nova"""
    if not await db.get(Cliente, pagamento_create.cliente_id):
        instancia_nao_encontrada("Cliente")

    result = await db.exec(
        select(Venda)
        .where(Venda.cliente_id == pagamento_create.cliente_id, condicao_fiado_aberto())
        .order_by(Venda.data_venda, Venda.id)
        .with_for_update()
    )
    vendas_abertas = result.all()
    saldos = [venda.valor_total + venda.taxa_entrega - venda.valor_pago for venda in vendas_abertas]
    saldo_total = sum(saldos, Decimal(0))

    if saldo_total == 0:
        regra_de_negocio("Este cliente não tem fiado em aberto.")
    if pagamento_create.valor > saldo_total:
        regra_de_negocio(f"O valor é maior que o saldo devedor (R$ {saldo_total}).")

    for venda, abatido in zip(vendas_abertas, distribuir_fifo(pagamento_create.valor, saldos)):
        if abatido > 0:
            venda.valor_pago += abatido
            db.add(venda)

    # O valor abate a dívida; o acréscimo do cartão é pago à parte pelo cliente
    acrescimo, taxa = await calcular_taxa(db, pagamento_create.forma_pagamento, pagamento_create.valor)
    pagamento = PagamentoFiado(**pagamento_create.model_dump(), usuario_id=usuario_id,
                               acrescimo_pagamento=acrescimo, taxa_pagamento=taxa)
    db.add(pagamento)
    await db.commit()

    result = await db.exec(query_pagamentos().where(PagamentoFiado.id == pagamento.id))
    return montar_pagamento_response(*result.one())
