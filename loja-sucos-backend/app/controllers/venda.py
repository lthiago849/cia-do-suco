from uuid import UUID
from datetime import date
from decimal import Decimal
from collections import defaultdict
from typing import Optional

from sqlalchemy.orm import aliased
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.const.enums import FormaPagamento
from app.controllers.taxa_pagamento import calcular_taxa
from app.exceptions.db import instancia_nao_encontrada
from app.exceptions.genericos import regra_de_negocio, conflito
from app.models.cliente import Cliente
from app.models.item_venda import ItemVenda
from app.models.produto import Produto
from app.models.usuario import Usuario
from app.models.venda import Venda
from app.schemas.venda import VendaCreate, VendaResponse, ItemVendaResponse, CancelamentoVenda
from app.utils.estoque import arredondar_dinheiro
from app.utils.periodo import filtrar_periodo
from app.validations.validar_horario import validar_horario


def query_vendas():
    quem_cancelou = aliased(Usuario)
    return (
        select(Venda, Usuario.nome.label("usuario_nome"), Cliente.nome.label("cliente_nome"),
               quem_cancelou.nome.label("cancelada_por_nome"))
        .join(Usuario, Venda.usuario_id == Usuario.id)
        .outerjoin(Cliente, Venda.cliente_id == Cliente.id)
        .outerjoin(quem_cancelou, Venda.cancelada_por == quem_cancelou.id)
    )


async def montar_vendas(db: AsyncSession, query) -> list[VendaResponse]:
    """Executa <query> (baseada em query_vendas) e anexa os itens de cada venda"""
    linhas = (await db.exec(query)).all()
    if not linhas:
        return []

    ids_vendas = [venda.id for venda, *_ in linhas]
    result_itens = await db.exec(
        select(ItemVenda, Produto.nome, Produto.categoria)
        .join(Produto, ItemVenda.produto_id == Produto.id)
        .where(col(ItemVenda.venda_id).in_(ids_vendas))
        .order_by(Produto.nome)
    )
    itens_por_venda = defaultdict(list)
    for item, produto_nome, categoria in result_itens.all():
        itens_por_venda[item.venda_id].append(ItemVendaResponse(
            produto_id=item.produto_id,
            produto_nome=produto_nome,
            categoria=categoria,
            quantidade=item.quantidade,
            preco_unitario=item.preco_unitario,
            custo_unitario=item.custo_unitario,
            subtotal=item.preco_unitario * item.quantidade,
        ))

    return [
        VendaResponse.model_validate({
            **venda.model_dump(),
            "usuario_nome": usuario_nome,
            "cliente_nome": cliente_nome,
            "cancelada_por_nome": cancelada_por_nome,
            "itens": itens_por_venda[venda.id],
        })
        for venda, usuario_nome, cliente_nome, cancelada_por_nome in linhas
    ]


async def get_venda_by_id(db: AsyncSession, id_venda: UUID) -> VendaResponse:
    vendas = await montar_vendas(db, query_vendas().where(Venda.id == id_venda))
    if not vendas:
        instancia_nao_encontrada("Venda")
    return vendas[0]


async def listar_vendas(db: AsyncSession, data_inicio: Optional[date] = None, data_fim: Optional[date] = None,
                        forma_pagamento: Optional[FormaPagamento] = None, cliente_id: Optional[UUID] = None,
                        usuario_id: Optional[UUID] = None, incluir_canceladas: bool = False,
                        limit: int = 100, offset: int = 0) -> list[VendaResponse]:
    query = filtrar_periodo(query_vendas(), Venda.data_venda, data_inicio, data_fim)
    if forma_pagamento is not None:
        query = query.where(Venda.forma_pagamento == forma_pagamento)
    if cliente_id is not None:
        query = query.where(Venda.cliente_id == cliente_id)
    if usuario_id is not None:
        query = query.where(Venda.usuario_id == usuario_id)
    if not incluir_canceladas:
        query = query.where(col(Venda.cancelada_em).is_(None))

    query = query.order_by(col(Venda.data_venda).desc()).limit(limit).offset(offset)
    return await montar_vendas(db, query)


async def travar_produtos(db: AsyncSession, ids_produtos) -> dict[UUID, Produto]:
    """SELECT ... FOR UPDATE nos produtos, sempre na mesma ordem para evitar deadlock"""
    result = await db.exec(
        select(Produto)
        .where(col(Produto.id).in_(list(ids_produtos)))
        .order_by(Produto.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return {produto.id: produto for produto in result.all()}


async def criar_venda(db: AsyncSession, venda_create: VendaCreate, usuario_id: UUID) -> VendaResponse:
    venda = await registrar_venda(db, venda_create, usuario_id)
    await db.commit()
    return await get_venda_by_id(db, venda.id)


async def registrar_venda(db: AsyncSession, venda_create: VendaCreate, usuario_id: UUID,
                          taxa_entrega: Decimal = Decimal(0)) -> Venda:
    """Registra a venda com os preços e custos atuais e baixa o estoque, sem fazer commit: quem chama decide
    (a confirmação de entrega de um pedido grava a venda e o pedido na mesma transação).
    <taxa_entrega>: nas entregas, cobrada junto com os produtos (entra no cartão e no fiado)."""
    quantidades: dict[UUID, int] = defaultdict(int)
    for item in venda_create.itens:
        quantidades[item.produto_id] += item.quantidade

    if venda_create.cliente_id is not None:
        cliente = await db.get(Cliente, venda_create.cliente_id)
        if not cliente:
            instancia_nao_encontrada("Cliente")
        if not cliente.ativo:
            regra_de_negocio(f"O cliente {cliente.nome} está inativo.")

    produtos = await travar_produtos(db, quantidades.keys())
    if len(produtos) != len(quantidades):
        instancia_nao_encontrada("Produto")

    valor_total = Decimal(0)
    custo_total = Decimal(0)
    for produto_id, quantidade in quantidades.items():
        produto = produtos[produto_id]
        if not produto.ativo:
            regra_de_negocio(f"{produto.nome} está inativo e não pode ser vendido.")
        if produto.quantidade_estoque < quantidade:
            regra_de_negocio(f"Estoque insuficiente para {produto.nome}: disponível {produto.quantidade_estoque}.")
        valor_total += produto.preco_venda * quantidade
        custo_total += produto.custo_unitario * quantidade

    valor_total = arredondar_dinheiro(valor_total)
    taxa_entrega = arredondar_dinheiro(Decimal(taxa_entrega))
    valor_cobrado = valor_total + taxa_entrega
    acrescimo, taxa = await calcular_taxa(db, venda_create.forma_pagamento, valor_cobrado)
    venda = Venda(
        usuario_id=usuario_id,
        cliente_id=venda_create.cliente_id,
        forma_pagamento=venda_create.forma_pagamento,
        valor_total=valor_total,
        custo_total=arredondar_dinheiro(custo_total),
        taxa_entrega=taxa_entrega,
        valor_pago=Decimal(0) if venda_create.forma_pagamento == FormaPagamento.FIADO else valor_cobrado,
        acrescimo_pagamento=acrescimo,
        taxa_pagamento=taxa,
        observacao=venda_create.observacao,
    )
    db.add(venda)
    await db.flush()

    for produto_id, quantidade in quantidades.items():
        produto = produtos[produto_id]
        produto.quantidade_estoque -= quantidade
        db.add(produto)
        db.add(ItemVenda(
            venda_id=venda.id,
            produto_id=produto_id,
            quantidade=quantidade,
            preco_unitario=produto.preco_venda,
            custo_unitario=produto.custo_unitario,
        ))

    await db.flush()
    return venda


async def cancelar_venda(db: AsyncSession, id_venda: UUID, usuario_id: UUID,
                         cancelamento: CancelamentoVenda) -> VendaResponse:
    """Marca a venda como cancelada (guardando quem cancelou e o motivo) e devolve os produtos ao estoque"""
    result = await db.exec(select(Venda).where(Venda.id == id_venda).with_for_update())
    venda = result.one_or_none()
    if not venda:
        instancia_nao_encontrada("Venda")
    if venda.cancelada_em is not None:
        conflito("Esta venda já foi cancelada.")
    if venda.forma_pagamento == FormaPagamento.FIADO and venda.valor_pago > 0:
        regra_de_negocio("Esta venda fiado já recebeu pagamentos e não pode ser cancelada.")

    itens = (await db.exec(select(ItemVenda).where(ItemVenda.venda_id == id_venda))).all()
    produtos = await travar_produtos(db, {item.produto_id for item in itens})
    for item in itens:
        produtos[item.produto_id].quantidade_estoque += item.quantidade
        db.add(produtos[item.produto_id])

    venda.cancelada_em = validar_horario()
    venda.cancelada_por = usuario_id
    venda.motivo_cancelamento = cancelamento.motivo
    db.add(venda)
    await db.commit()

    return await get_venda_by_id(db, id_venda)
