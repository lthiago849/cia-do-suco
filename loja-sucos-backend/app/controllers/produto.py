from uuid import UUID
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, update
from sqlalchemy.exc import IntegrityError
from sqlmodel import select, or_, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.const.enums import CategoriaProduto, TipoIngrediente
from app.exceptions.db import instancia_nao_encontrada, erro_de_integridade_sql
from app.exceptions.genericos import regra_de_negocio
from app.models.ingrediente import Ingrediente
from app.models.item_venda import ItemVenda
from app.models.producao import Producao
from app.models.produto import Produto
from app.models.venda import Venda
from app.schemas.produto import ProdutoCreate, ProdutoUpdate, ProdutoResponse
from app.utils.estoque import arredondar_dinheiro, QUATRO_CASAS


def query_produtos():
    """Produtos com o nome da polpa/fruta, quantas unidades foram vendidas com custo zero e a última produção"""
    sem_custo = (
        select(ItemVenda.produto_id, func.sum(ItemVenda.quantidade).label("qtd"))
        .join(Venda, ItemVenda.venda_id == Venda.id)
        .where(ItemVenda.custo_unitario == 0, col(Venda.cancelada_em).is_(None))
        .group_by(ItemVenda.produto_id)
        .subquery()
    )
    ultima_producao = (
        select(Producao.produto_id, Producao.custo_total, Producao.quantidade_produzida)
        .distinct(Producao.produto_id)
        .order_by(Producao.produto_id, col(Producao.produzido_em).desc())
        .subquery()
    )
    return (
        select(Produto, Ingrediente.nome, sem_custo.c.qtd, ultima_producao.c.custo_total,
               ultima_producao.c.quantidade_produzida)
        .outerjoin(Ingrediente, Produto.ingrediente_id == Ingrediente.id)
        .outerjoin(sem_custo, sem_custo.c.produto_id == Produto.id)
        .outerjoin(ultima_producao, ultima_producao.c.produto_id == Produto.id)
    )


def montar_produto_response(produto: Produto, ingrediente_nome: Optional[str], vendidos_sem_custo: Optional[int],
                            custo_producao: Optional[Decimal], qtd_producao: Optional[int]) -> ProdutoResponse:
    custo_ultima_producao = None
    if qtd_producao:
        custo_ultima_producao = (Decimal(custo_producao) / qtd_producao).quantize(QUATRO_CASAS)
    return ProdutoResponse.model_validate({**produto.model_dump(), "ingrediente_nome": ingrediente_nome,
                                           "vendidos_sem_custo": int(vendidos_sem_custo or 0),
                                           "custo_ultima_producao": custo_ultima_producao})


async def validar_ingrediente_base(db: AsyncSession, ingrediente_id: Optional[UUID]):
    if ingrediente_id is None:
        return
    ingrediente = await db.get(Ingrediente, ingrediente_id)
    if not ingrediente:
        instancia_nao_encontrada("Ingrediente")
    if ingrediente.tipo not in (TipoIngrediente.POLPA, TipoIngrediente.FRUTA):
        regra_de_negocio("O ingrediente do produto deve ser uma fruta ou polpa.")


async def listar_produtos(db: AsyncSession, categoria: Optional[CategoriaProduto] = None,
                          ativo: Optional[bool] = None, busca: Optional[str] = None) -> list[ProdutoResponse]:
    query = query_produtos().order_by(Produto.categoria, Produto.nome)
    if categoria is not None:
        query = query.where(Produto.categoria == categoria)
    if ativo is not None:
        query = query.where(Produto.ativo == ativo)
    if busca:
        query = query.where(or_(col(Produto.nome).ilike(f"%{busca}%"), col(Produto.descricao).ilike(f"%{busca}%")))

    result = await db.exec(query)
    return [montar_produto_response(*linha) for linha in result.all()]


async def get_produto_by_id(db: AsyncSession, id_produto: UUID) -> ProdutoResponse:
    linha = (await db.exec(query_produtos().where(Produto.id == id_produto))).one_or_none()
    if not linha:
        instancia_nao_encontrada("Produto")
    return montar_produto_response(*linha)


async def criar_produto(db: AsyncSession, produto_create: ProdutoCreate) -> ProdutoResponse:
    await validar_ingrediente_base(db, produto_create.ingrediente_id)

    db_produto = Produto(**produto_create.model_dump())
    db.add(db_produto)

    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        erro_de_integridade_sql(e)

    return await get_produto_by_id(db, db_produto.id)


async def atualizar_produto(db: AsyncSession, produto_update: ProdutoUpdate, id_produto: UUID) -> ProdutoResponse:
    produto = await db.get(Produto, id_produto)
    if not produto:
        instancia_nao_encontrada("Produto")

    if "ingrediente_id" in produto_update.model_fields_set:
        await validar_ingrediente_base(db, produto_update.ingrediente_id)

    for campo, valor in produto_update.model_dump(exclude_unset=True,
                                                  exclude={"aplicar_custo_vendas_sem_custo"}).items():
        setattr(produto, campo, valor)
    db.add(produto)

    if produto_update.aplicar_custo_vendas_sem_custo:
        if not produto_update.custo_unitario:
            regra_de_negocio("Informe o custo por unidade para aplicar nas vendas sem custo.")
        await aplicar_custo_vendas_sem_custo(db, id_produto, produto_update.custo_unitario)

    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        erro_de_integridade_sql(e)

    return await get_produto_by_id(db, id_produto)


async def aplicar_custo_vendas_sem_custo(db: AsyncSession, id_produto: UUID, custo: Decimal) -> None:
    """Grava <custo> nos itens vendidos deste produto que ficaram com custo zero e refaz o custo total
    dessas vendas. Só mexe no custo: preço, quantidades, estoque e pagamentos ficam como estão."""
    result = await db.exec(
        update(ItemVenda)
        .where(ItemVenda.produto_id == id_produto, ItemVenda.custo_unitario == 0)
        .values(custo_unitario=custo)
        .returning(ItemVenda.venda_id)
    )
    ids_vendas = {id_venda for (id_venda,) in result.all()}
    if not ids_vendas:
        return

    custos = await db.exec(
        select(ItemVenda.venda_id, func.sum(ItemVenda.quantidade * ItemVenda.custo_unitario))
        .where(col(ItemVenda.venda_id).in_(ids_vendas))
        .group_by(ItemVenda.venda_id)
    )
    for id_venda, custo_total in custos.all():
        await db.exec(update(Venda).where(Venda.id == id_venda).values(custo_total=arredondar_dinheiro(custo_total)))
