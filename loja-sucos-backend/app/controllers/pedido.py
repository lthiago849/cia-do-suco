from uuid import UUID
from datetime import date
from decimal import Decimal
from collections import defaultdict
from typing import Optional

from sqlalchemy import delete, func
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.const.enums import FormaPagamento, OrigemPedido, StatusPedido
from app.controllers.venda import registrar_venda
from app.exceptions.db import instancia_nao_encontrada
from app.exceptions.genericos import regra_de_negocio
from app.models.cliente import Cliente
from app.models.endereco_cliente import EnderecoCliente
from app.models.item_venda import ItemVenda
from app.models.pedido import Pedido, ItemPedido
from app.models.produto import Produto
from app.models.usuario import Usuario
from app.schemas.cliente import EnderecoResponse
from app.schemas.pedido import (
    PedidoCreate, PedidoUpdate, EntregaPedido, CancelamentoPedido, PedidoResponse,
    ItemPedidoResponse, EntregadorResumo
)
from app.schemas.venda import VendaCreate, ItemVendaCreate
from app.utils.periodo import filtrar_periodo
from app.validations.validar_horario import validar_horario



async def montar_pedidos(db: AsyncSession, query) -> list[PedidoResponse]:
    """Executa <query> (select de Pedido) e junta cliente, endereço, itens e nomes dos funcionários"""
    pedidos = (await db.exec(query)).all()
    if not pedidos:
        return []

    ids = [p.id for p in pedidos]
    clientes = {c.id: c for c in (await db.exec(
        select(Cliente).where(col(Cliente.id).in_({p.cliente_id for p in pedidos})))).all()}
    ids_enderecos = {p.endereco_id for p in pedidos if p.endereco_id}
    enderecos = {e.id: e for e in (await db.exec(
        select(EnderecoCliente).where(col(EnderecoCliente.id).in_(ids_enderecos))))} if ids_enderecos else {}
    ids_usuarios = {u for p in pedidos for u in (p.criado_por, p.entregador_id, p.confirmado_por, p.cancelado_por) if u}
    nomes = {u.id: u.nome for u in (await db.exec(
        select(Usuario).where(col(Usuario.id).in_(ids_usuarios))))} if ids_usuarios else {}

    # Depois da entrega vale o preço registrado na venda; antes, o preço atual do produto
    ids_vendas = [p.venda_id for p in pedidos if p.venda_id]
    precos_venda = {(i.venda_id, i.produto_id): i.preco_unitario for i in (await db.exec(
        select(ItemVenda).where(col(ItemVenda.venda_id).in_(ids_vendas))))} if ids_vendas else {}
    venda_do_pedido = {p.id: p.venda_id for p in pedidos}

    itens_por_pedido = defaultdict(list)
    for item, produto in (await db.exec(
        select(ItemPedido, Produto)
        .join(Produto, ItemPedido.produto_id == Produto.id)
        .where(col(ItemPedido.pedido_id).in_(ids))
        .order_by(Produto.nome)
    )).all():
        preco = precos_venda.get((venda_do_pedido[item.pedido_id], item.produto_id), produto.preco_venda)
        itens_por_pedido[item.pedido_id].append(ItemPedidoResponse(
            produto_id=produto.id,
            produto_nome=produto.nome,
            categoria=produto.categoria,
            quantidade=item.quantidade,
            preco_unitario=preco,
            subtotal=preco * item.quantidade,
            estoque_disponivel=produto.quantidade_estoque,
        ))

    respostas = []
    for p in pedidos:
        cliente = clientes[p.cliente_id]
        endereco = enderecos.get(p.endereco_id)
        itens = itens_por_pedido[p.id]
        respostas.append(PedidoResponse(
            id=p.id,
            origem=p.origem,
            status=p.status,
            cliente_id=cliente.id,
            cliente_nome=cliente.nome,
            cliente_telefone=cliente.telefone,
            endereco=EnderecoResponse.model_validate(endereco) if endereco else None,
            itens=itens,
            total_produtos=sum((i.subtotal for i in itens), Decimal(0)),
            forma_pagamento=p.forma_pagamento,
            observacao=p.observacao,
            taxa_entrega=p.taxa_entrega,
            entregador_id=p.entregador_id,
            entregador_nome=nomes.get(p.entregador_id),
            criado_por_nome=nomes.get(p.criado_por),
            confirmado_por_nome=nomes.get(p.confirmado_por),
            cancelado_por_nome=nomes.get(p.cancelado_por),
            motivo_cancelamento=p.motivo_cancelamento,
            venda_id=p.venda_id,
            created_at=p.created_at,
            entregue_em=p.entregue_em,
            cancelado_em=p.cancelado_em,
        ))
    return respostas


async def get_pedido_by_id(db: AsyncSession, id_pedido: UUID) -> PedidoResponse:
    pedidos = await montar_pedidos(db, select(Pedido).where(Pedido.id == id_pedido))
    if not pedidos:
        instancia_nao_encontrada("Pedido")
    return pedidos[0]


async def listar_pedidos(db: AsyncSession, abertos: bool = False, status: Optional[StatusPedido] = None,
                         data_inicio: Optional[date] = None, data_fim: Optional[date] = None,
                         entregador_id: Optional[UUID] = None, cliente_id: Optional[UUID] = None,
                         limit: int = 100, offset: int = 0) -> list[PedidoResponse]:
    """<abertos>: pedidos aguardando entrega, do mais antigo para o mais novo (fila de trabalho).
    Senão, histórico do mais novo para o mais antigo."""
    query = filtrar_periodo(select(Pedido), Pedido.created_at, data_inicio, data_fim)
    if abertos:
        query = query.where(Pedido.status == StatusPedido.NOVO).order_by(Pedido.created_at)
    else:
        query = query.order_by(col(Pedido.created_at).desc())
    if status is not None:
        query = query.where(Pedido.status == status)
    if entregador_id is not None:
        query = query.where(Pedido.entregador_id == entregador_id)
    if cliente_id is not None:
        query = query.where(Pedido.cliente_id == cliente_id)
    return await montar_pedidos(db, query.limit(limit).offset(offset))


async def travar_pedido(db: AsyncSession, id_pedido: UUID) -> Pedido:
    pedido = (await db.exec(select(Pedido).where(Pedido.id == id_pedido).with_for_update())).one_or_none()
    if not pedido:
        instancia_nao_encontrada("Pedido")
    return pedido


async def resolver_endereco(db: AsyncSession, cliente_id: UUID, endereco_id: Optional[UUID]) -> Optional[UUID]:
    """Endereço informado (precisa ser do cliente) ou, sem informar, o endereço atual do cliente"""
    if endereco_id is not None:
        endereco = await db.get(EnderecoCliente, endereco_id)
        if not endereco or endereco.cliente_id != cliente_id:
            instancia_nao_encontrada("Endereco deste cliente")
        return endereco.id
    atual = (await db.exec(select(EnderecoCliente).where(
        EnderecoCliente.cliente_id == cliente_id, EnderecoCliente.ativo == True))).one_or_none()  # noqa: E712
    return atual.id if atual else None


async def salvar_itens(db: AsyncSession, pedido_id: UUID, itens: list[ItemVendaCreate]):
    """Substitui os itens do pedido. O estoque só é conferido (e baixado) na confirmação da entrega."""
    quantidades: dict[UUID, int] = defaultdict(int)
    for item in itens:
        quantidades[item.produto_id] += item.quantidade

    produtos = (await db.exec(select(Produto).where(col(Produto.id).in_(list(quantidades))))).all()
    if len(produtos) != len(quantidades):
        instancia_nao_encontrada("Produto")
    for produto in produtos:
        if not produto.ativo:
            regra_de_negocio(f"{produto.nome} está inativo.")

    await db.execute(delete(ItemPedido).where(ItemPedido.pedido_id == pedido_id))
    for produto_id, quantidade in quantidades.items():
        db.add(ItemPedido(pedido_id=pedido_id, produto_id=produto_id, quantidade=quantidade))


async def criar_pedido(db: AsyncSession, pedido_create: PedidoCreate, origem: OrigemPedido,
                       usuario_id: Optional[UUID]) -> PedidoResponse:
    cliente = await db.get(Cliente, pedido_create.cliente_id)
    if not cliente:
        instancia_nao_encontrada("Cliente")
    if not cliente.ativo:
        regra_de_negocio(f"O cliente {cliente.nome} está inativo.")
    # O cliente nunca escolhe fiado pelo WhatsApp: só o atendente, na revisão
    if origem == OrigemPedido.WHATSAPP and pedido_create.forma_pagamento == FormaPagamento.FIADO:
        regra_de_negocio("Fiado só pode ser definido pelo atendente.")

    pedido = Pedido(
        cliente_id=cliente.id,
        endereco_id=await resolver_endereco(db, cliente.id, pedido_create.endereco_id),
        origem=origem,
        forma_pagamento=pedido_create.forma_pagamento,
        observacao=pedido_create.observacao,
        criado_por=usuario_id,
    )
    db.add(pedido)
    await db.flush()
    await salvar_itens(db, pedido.id, pedido_create.itens)
    await db.commit()
    return await get_pedido_by_id(db, pedido.id)


async def atualizar_pedido(db: AsyncSession, id_pedido: UUID, pedido_update: PedidoUpdate) -> PedidoResponse:
    """Revisão do atendente: itens, endereço, forma de pagamento (inclusive fiado) e observação"""
    pedido = await travar_pedido(db, id_pedido)
    if pedido.status != StatusPedido.NOVO:
        regra_de_negocio("Só dá para alterar um pedido que ainda não foi entregue nem cancelado.")

    campos = pedido_update.model_fields_set
    if "endereco_id" in campos:
        pedido.endereco_id = await resolver_endereco(db, pedido.cliente_id, pedido_update.endereco_id)
    if "forma_pagamento" in campos:
        pedido.forma_pagamento = pedido_update.forma_pagamento
    if "observacao" in campos:
        pedido.observacao = pedido_update.observacao
    if pedido_update.itens:
        await salvar_itens(db, pedido.id, pedido_update.itens)

    db.add(pedido)
    await db.commit()
    return await get_pedido_by_id(db, id_pedido)


async def confirmar_entrega(db: AsyncSession, id_pedido: UUID, entrega: EntregaPedido, usuario_id: UUID) -> PedidoResponse:
    """Transforma o pedido em venda (preços, custos e taxa da maquininha do momento, baixa de estoque e,
    se for o caso, fiado do cliente) e registra quem entregou e a taxa de entrega dele"""
    pedido = await travar_pedido(db, id_pedido)
    if pedido.status != StatusPedido.NOVO:
        regra_de_negocio("Este pedido já foi entregue ou cancelado.")
    if pedido.endereco_id is None:
        regra_de_negocio("Cadastre o endereço do cliente antes de confirmar a entrega.")
    entregador = await db.get(Usuario, entrega.entregador_id)
    if not entregador or not entregador.ativo:
        instancia_nao_encontrada("Entregador")

    itens = (await db.exec(select(ItemPedido).where(ItemPedido.pedido_id == pedido.id))).all()
    venda = await registrar_venda(db, VendaCreate(
        itens=[ItemVendaCreate(produto_id=i.produto_id, quantidade=i.quantidade) for i in itens],
        forma_pagamento=entrega.forma_pagamento,
        cliente_id=pedido.cliente_id,
        observacao=pedido.observacao,
    ), usuario_id, taxa_entrega=entrega.taxa_entrega)

    pedido.status = StatusPedido.ENTREGUE
    pedido.entregador_id = entregador.id
    pedido.forma_pagamento = entrega.forma_pagamento
    pedido.taxa_entrega = entrega.taxa_entrega
    pedido.venda_id = venda.id
    pedido.confirmado_por = usuario_id
    pedido.entregue_em = validar_horario()
    db.add(pedido)
    await db.commit()
    return await get_pedido_by_id(db, id_pedido)


async def cancelar_pedido(db: AsyncSession, id_pedido: UUID, cancelamento: CancelamentoPedido,
                          usuario_id: UUID) -> PedidoResponse:
    pedido = await travar_pedido(db, id_pedido)
    if pedido.status != StatusPedido.NOVO:
        regra_de_negocio("Este pedido já foi entregue ou cancelado.")

    pedido.status = StatusPedido.CANCELADO
    pedido.motivo_cancelamento = cancelamento.motivo
    pedido.cancelado_por = usuario_id
    pedido.cancelado_em = validar_horario()
    db.add(pedido)
    await db.commit()
    return await get_pedido_by_id(db, id_pedido)


async def resumo_entregadores(db: AsyncSession, data_inicio: Optional[date],
                              data_fim: Optional[date]) -> list[EntregadorResumo]:
    """Entregas confirmadas por entregador no período (pela data da entrega) e o total de taxas que recebeu"""
    result = await db.exec(filtrar_periodo(
        select(Usuario.id, Usuario.nome, func.count(Pedido.id), func.coalesce(func.sum(Pedido.taxa_entrega), 0))
        .join(Pedido, Pedido.entregador_id == Usuario.id)
        .where(Pedido.status == StatusPedido.ENTREGUE)
        .group_by(Usuario.id)
        .order_by(func.count(Pedido.id).desc()),
        Pedido.entregue_em, data_inicio, data_fim,
    ))
    return [
        EntregadorResumo(entregador_id=uid, nome=nome, entregas=entregas, total_taxas=total)
        for uid, nome, entregas, total in result.all()
    ]
