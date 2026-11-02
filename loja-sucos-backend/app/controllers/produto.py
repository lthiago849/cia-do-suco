from uuid import UUID
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlmodel import select, or_, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.const.enums import CategoriaProduto, TipoIngrediente
from app.exceptions.db import instancia_nao_encontrada, erro_de_integridade_sql
from app.exceptions.genericos import regra_de_negocio
from app.models.ingrediente import Ingrediente
from app.models.produto import Produto
from app.schemas.produto import ProdutoCreate, ProdutoUpdate, ProdutoResponse
from app.utils.generic_db_operations import atualizar_instancia


def montar_produto_response(produto: Produto, ingrediente_nome: Optional[str]) -> ProdutoResponse:
    return ProdutoResponse.model_validate({**produto.model_dump(), "ingrediente_nome": ingrediente_nome})


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
    query = (
        select(Produto, Ingrediente.nome)
        .outerjoin(Ingrediente, Produto.ingrediente_id == Ingrediente.id)
        .order_by(Produto.categoria, Produto.nome)
    )
    if categoria is not None:
        query = query.where(Produto.categoria == categoria)
    if ativo is not None:
        query = query.where(Produto.ativo == ativo)
    if busca:
        query = query.where(or_(col(Produto.nome).ilike(f"%{busca}%"), col(Produto.descricao).ilike(f"%{busca}%")))

    result = await db.exec(query)
    return [montar_produto_response(produto, nome_ingrediente) for produto, nome_ingrediente in result.all()]


async def get_produto_by_id(db: AsyncSession, id_produto: UUID) -> ProdutoResponse:
    produto = await db.get(Produto, id_produto)
    if not produto:
        instancia_nao_encontrada("Produto")

    ingrediente = await db.get(Ingrediente, produto.ingrediente_id) if produto.ingrediente_id else None
    return montar_produto_response(produto, ingrediente.nome if ingrediente else None)


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

    await atualizar_instancia(produto, produto_update)
    db.add(produto)

    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        erro_de_integridade_sql(e)

    return await get_produto_by_id(db, id_produto)
