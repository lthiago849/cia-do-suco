from uuid import UUID
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import func
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.exceptions.db import instancia_nao_encontrada
from app.exceptions.genericos import regra_de_negocio
from app.models.descarte_estoque import DescarteEstoque
from app.models.entrada_estoque import EntradaEstoque
from app.models.ingrediente import Ingrediente
from app.models.produto import Produto
from app.models.usuario import Usuario
from app.schemas.descarte_estoque import DescarteCreate, DescarteResponse
from app.utils.estoque import arredondar_dinheiro, calcular_custo_apos_descarte
from app.utils.periodo import filtrar_periodo


def query_descartes():
    return (
        select(DescarteEstoque,
               func.coalesce(Produto.nome, Ingrediente.nome).label("item_nome"),
               Usuario.nome.label("usuario_nome"))
        .outerjoin(Produto, DescarteEstoque.produto_id == Produto.id)
        .outerjoin(Ingrediente, DescarteEstoque.ingrediente_id == Ingrediente.id)
        .join(Usuario, DescarteEstoque.usuario_id == Usuario.id)
    )


def montar_descarte_response(descarte: DescarteEstoque, item_nome: str, usuario_nome: str) -> DescarteResponse:
    return DescarteResponse.model_validate(
        {**descarte.model_dump(), "item_nome": item_nome, "usuario_nome": usuario_nome})


async def listar_descartes(db: AsyncSession, data_inicio: Optional[date] = None, data_fim: Optional[date] = None,
                           limit: int = 100, offset: int = 0) -> list[DescarteResponse]:
    query = filtrar_periodo(query_descartes(), DescarteEstoque.created_at, data_inicio, data_fim)
    query = query.order_by(col(DescarteEstoque.created_at).desc()).limit(limit).offset(offset)
    result = await db.exec(query)
    return [montar_descarte_response(*linha) for linha in result.all()]


async def registrar_descarte(db: AsyncSession, descarte_create: DescarteCreate, usuario_id: UUID) -> DescarteResponse:
    """Tira do estoque o que foi jogado fora e repassa o custo disso para o que sobrou"""
    if descarte_create.produto_id is not None:
        modelo, id_alvo, coluna_entrada, nome_modelo = Produto, descarte_create.produto_id, "produto_id", "Produto"
    else:
        modelo, id_alvo, coluna_entrada, nome_modelo = (Ingrediente, descarte_create.ingrediente_id,
                                                        "ingrediente_id", "Ingrediente")

    alvo = (await db.exec(select(modelo).where(modelo.id == id_alvo).with_for_update())).one_or_none()
    if not alvo:
        instancia_nao_encontrada(nome_modelo)
    if descarte_create.quantidade > alvo.quantidade_estoque:
        regra_de_negocio(f"Só há {Decimal(alvo.quantidade_estoque).normalize():f} de {alvo.nome} em estoque.")

    if descarte_create.entrada_estoque_id is not None:
        entrada = (await db.exec(
            select(EntradaEstoque).where(EntradaEstoque.id == descarte_create.entrada_estoque_id).with_for_update()
        )).one_or_none()
        if not entrada or getattr(entrada, coluna_entrada) != alvo.id:
            instancia_nao_encontrada(f"Compra deste {nome_modelo.lower()}")
        ja_descartado = Decimal((await db.exec(
            select(func.coalesce(func.sum(DescarteEstoque.quantidade), 0))
            .where(DescarteEstoque.entrada_estoque_id == entrada.id)
        )).one())
        if ja_descartado + descarte_create.quantidade > entrada.quantidade:
            regra_de_negocio(f"Desta compra de {entrada.quantidade.normalize():f} já foram descartadas "
                             f"{ja_descartado.normalize():f}.")

    valor_perdido = arredondar_dinheiro(descarte_create.quantidade * alvo.custo_unitario)
    alvo.custo_unitario = calcular_custo_apos_descarte(
        alvo.quantidade_estoque, alvo.custo_unitario, descarte_create.quantidade)
    if modelo is Produto:
        alvo.quantidade_estoque -= int(descarte_create.quantidade)
    else:
        alvo.quantidade_estoque -= descarte_create.quantidade
    db.add(alvo)

    descarte = DescarteEstoque(**descarte_create.model_dump(), usuario_id=usuario_id, valor_perdido=valor_perdido)
    db.add(descarte)
    await db.commit()

    result = await db.exec(query_descartes().where(DescarteEstoque.id == descarte.id))
    return montar_descarte_response(*result.one())
