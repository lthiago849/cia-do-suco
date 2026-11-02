from uuid import UUID
from datetime import date
from typing import Optional

from sqlalchemy import func
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.const.enums import TipoIngrediente
from app.exceptions.db import instancia_nao_encontrada
from app.exceptions.genericos import regra_de_negocio
from app.models.descarte_estoque import DescarteEstoque
from app.models.entrada_estoque import EntradaEstoque
from app.models.ingrediente import Ingrediente
from app.models.produto import Produto
from app.models.usuario import Usuario
from app.schemas.entrada_estoque import EntradaEstoqueCreate, EntradaEstoqueResponse
from app.utils.estoque import calcular_custo_medio
from app.utils.periodo import filtrar_periodo


def query_entradas():
    descartes = (
        select(DescarteEstoque.entrada_estoque_id, func.sum(DescarteEstoque.quantidade).label("quantidade"))
        .group_by(DescarteEstoque.entrada_estoque_id)
        .subquery()
    )
    return (
        select(EntradaEstoque,
               func.coalesce(Produto.nome, Ingrediente.nome).label("item_nome"),
               Usuario.nome.label("usuario_nome"),
               func.coalesce(descartes.c.quantidade, 0).label("quantidade_descartada"))
        .outerjoin(Produto, EntradaEstoque.produto_id == Produto.id)
        .outerjoin(Ingrediente, EntradaEstoque.ingrediente_id == Ingrediente.id)
        .outerjoin(descartes, descartes.c.entrada_estoque_id == EntradaEstoque.id)
        .join(Usuario, EntradaEstoque.usuario_id == Usuario.id)
    )


def montar_entrada_response(entrada: EntradaEstoque, item_nome: str, usuario_nome: str,
                            quantidade_descartada) -> EntradaEstoqueResponse:
    return EntradaEstoqueResponse.model_validate({
        **entrada.model_dump(),
        "item_nome": item_nome,
        "usuario_nome": usuario_nome,
        "quantidade_descartada": quantidade_descartada,
    })


async def listar_entradas(db: AsyncSession, data_inicio: Optional[date] = None, data_fim: Optional[date] = None,
                          ingrediente_id: Optional[UUID] = None, produto_id: Optional[UUID] = None, limit: int = 100,
                          offset: int = 0) -> list[EntradaEstoqueResponse]:
    query = filtrar_periodo(query_entradas(), EntradaEstoque.created_at, data_inicio, data_fim)
    if ingrediente_id is not None:
        query = query.where(EntradaEstoque.ingrediente_id == ingrediente_id)
    if produto_id is not None:
        query = query.where(EntradaEstoque.produto_id == produto_id)
    query = query.order_by(col(EntradaEstoque.created_at).desc()).limit(limit).offset(offset)
    result = await db.exec(query)
    return [montar_entrada_response(*linha) for linha in result.all()]


async def registrar_entrada(db: AsyncSession, entrada_create: EntradaEstoqueCreate,
                            usuario_id: UUID) -> EntradaEstoqueResponse:
    """Soma a compra ao estoque e recalcula o custo médio do item"""
    if entrada_create.produto_id is not None:
        modelo, id_alvo, nome_modelo = Produto, entrada_create.produto_id, "Produto"
    else:
        modelo, id_alvo, nome_modelo = Ingrediente, entrada_create.ingrediente_id, "Ingrediente"

    result = await db.exec(select(modelo).where(modelo.id == id_alvo).with_for_update())
    alvo = result.one_or_none()
    if not alvo:
        instancia_nao_encontrada(nome_modelo)
    if not alvo.ativo:
        regra_de_negocio(f"{alvo.nome} está inativo.")

    eh_garrafa = modelo is Ingrediente and alvo.tipo == TipoIngrediente.GARRAFA
    if eh_garrafa and entrada_create.condicao_garrafa is None:
        regra_de_negocio("Informe se as garrafas vieram limpas ou sujas.")
    if not eh_garrafa and entrada_create.condicao_garrafa is not None:
        regra_de_negocio("A condição (limpa/suja) só se aplica à compra de garrafas.")

    alvo.custo_unitario = calcular_custo_medio(alvo.quantidade_estoque, alvo.custo_unitario,
                                               entrada_create.quantidade, entrada_create.custo_total)
    if modelo is Produto:
        alvo.quantidade_estoque += int(entrada_create.quantidade)
    else:
        alvo.quantidade_estoque += entrada_create.quantidade

    entrada = EntradaEstoque(**entrada_create.model_dump(), usuario_id=usuario_id)
    db.add(alvo)
    db.add(entrada)
    await db.commit()

    result = await db.exec(query_entradas().where(EntradaEstoque.id == entrada.id))
    return montar_entrada_response(*result.one())
