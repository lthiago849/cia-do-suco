from uuid import UUID
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.const.enums import TipoIngrediente
from app.exceptions.db import instancia_nao_encontrada, erro_de_integridade_sql
from app.exceptions.genericos import conflito
from app.models.descarte_estoque import DescarteEstoque
from app.models.entrada_estoque import EntradaEstoque
from app.models.ingrediente import Ingrediente
from app.models.produto import Produto
from app.schemas.ingrediente import IngredienteCreate, IngredienteUpdate, IngredienteResponse
from app.utils.estoque import QUATRO_CASAS
from app.utils.generic_db_operations import atualizar_instancia


def query_ingredientes():
    """Ingredientes junto com a compra mais recente de cada um (para mostrar o preço da última compra
    ao lado do custo médio)"""
    ultima_compra = (
        select(EntradaEstoque.ingrediente_id, EntradaEstoque.quantidade, EntradaEstoque.custo_total,
               EntradaEstoque.created_at)
        .where(col(EntradaEstoque.ingrediente_id).is_not(None))
        .distinct(EntradaEstoque.ingrediente_id)
        .order_by(EntradaEstoque.ingrediente_id, col(EntradaEstoque.created_at).desc())
        .subquery()
    )
    return (
        select(Ingrediente, ultima_compra.c.quantidade, ultima_compra.c.custo_total, ultima_compra.c.created_at)
        .outerjoin(ultima_compra, ultima_compra.c.ingrediente_id == Ingrediente.id)
    )


def montar_ingrediente_response(ingrediente: Ingrediente, quantidade_compra: Optional[Decimal],
                                custo_compra: Optional[Decimal],
                                data_compra: Optional[datetime]) -> IngredienteResponse:
    ultimo_custo = None
    if quantidade_compra:
        ultimo_custo = (Decimal(custo_compra) / Decimal(quantidade_compra)).quantize(QUATRO_CASAS, ROUND_HALF_UP)
    return IngredienteResponse.model_validate({
        **ingrediente.model_dump(),
        "ultimo_custo_compra": ultimo_custo,
        "ultima_compra_em": data_compra,
    })


async def listar_ingredientes(db: AsyncSession, tipo: Optional[TipoIngrediente] = None,
                              ativo: Optional[bool] = None) -> list[IngredienteResponse]:
    query = query_ingredientes().order_by(Ingrediente.tipo, Ingrediente.nome)
    if tipo is not None:
        query = query.where(Ingrediente.tipo == tipo)
    if ativo is not None:
        query = query.where(Ingrediente.ativo == ativo)

    result = await db.exec(query)
    return [montar_ingrediente_response(*linha) for linha in result.all()]


async def get_ingrediente_by_id(db: AsyncSession, id_ingrediente: UUID) -> IngredienteResponse:
    result = await db.exec(query_ingredientes().where(Ingrediente.id == id_ingrediente))
    linha = result.one_or_none()
    if not linha:
        instancia_nao_encontrada("Ingrediente")
    return montar_ingrediente_response(*linha)


async def criar_ingrediente(db: AsyncSession, ingrediente_create: IngredienteCreate) -> IngredienteResponse:
    db_ingrediente = Ingrediente(**ingrediente_create.model_dump())
    db.add(db_ingrediente)

    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        erro_de_integridade_sql(e)

    return await get_ingrediente_by_id(db, db_ingrediente.id)


async def atualizar_ingrediente(db: AsyncSession, ingrediente_update: IngredienteUpdate,
                                id_ingrediente: UUID) -> IngredienteResponse:
    ingrediente = await db.get(Ingrediente, id_ingrediente)
    if not ingrediente:
        instancia_nao_encontrada("Ingrediente")

    await atualizar_instancia(ingrediente, ingrediente_update)
    db.add(ingrediente)

    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        erro_de_integridade_sql(e)

    return await get_ingrediente_by_id(db, id_ingrediente)


def plural(quantidade: int, singular: str, plural_: str) -> str:
    return f"{quantidade} {singular if quantidade == 1 else plural_}"


async def excluir_ingrediente(db: AsyncSession, id_ingrediente: UUID) -> None:
    """Apaga de vez um ingrediente que nunca foi usado (cadastrado errado). Se já tem compras, descartes ou
    produto ligado, apagar mudaria o histórico: nesse caso a saída é desativar."""
    ingrediente = await db.get(Ingrediente, id_ingrediente)
    if not ingrediente:
        instancia_nao_encontrada("Ingrediente")

    produtos = (await db.exec(select(Produto.nome).where(Produto.ingrediente_id == id_ingrediente))).all()
    compras = (await db.exec(
        select(func.count()).select_from(EntradaEstoque).where(EntradaEstoque.ingrediente_id == id_ingrediente)
    )).one()
    descartes = (await db.exec(
        select(func.count()).select_from(DescarteEstoque).where(DescarteEstoque.ingrediente_id == id_ingrediente)
    )).one()

    motivos = []
    if produtos:
        motivos.append(f"é usado pelo produto {', '.join(produtos)}")
    if compras:
        motivos.append(f"tem {plural(compras, 'compra registrada', 'compras registradas')}")
    if descartes:
        motivos.append(f"tem {plural(descartes, 'descarte registrado', 'descartes registrados')}")
    if motivos:
        conflito(f"{ingrediente.nome} não pode ser apagado porque {' e '.join(motivos)}. "
                 f"Desative em vez de apagar.")

    await db.delete(ingrediente)
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        erro_de_integridade_sql(e)
