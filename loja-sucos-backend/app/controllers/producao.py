from uuid import UUID
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.const.enums import TipoIngrediente
from app.exceptions.db import instancia_nao_encontrada
from app.exceptions.genericos import regra_de_negocio
from app.models.ingrediente import Ingrediente
from app.models.producao import Producao
from app.models.produto import Produto
from app.models.usuario import Usuario
from app.schemas.producao import ProducaoCreate, ProducaoResponse
from app.utils.estoque import arredondar_dinheiro, calcular_custo_medio, distribuir_fifo
from app.utils.periodo import filtrar_periodo


def query_producoes():
    return (
        select(Producao, Produto.nome.label("produto_nome"), Usuario.nome.label("usuario_nome"))
        .join(Produto, Producao.produto_id == Produto.id)
        .join(Usuario, Producao.usuario_id == Usuario.id)
    )


def montar_producao_response(producao: Producao, produto_nome: str, usuario_nome: str) -> ProducaoResponse:
    return ProducaoResponse.model_validate(
        {**producao.model_dump(), "produto_nome": produto_nome, "usuario_nome": usuario_nome})


async def listar_producoes(db: AsyncSession, data_inicio: Optional[date] = None, data_fim: Optional[date] = None,
                           produto_id: Optional[UUID] = None, limit: int = 100,
                           offset: int = 0) -> list[ProducaoResponse]:
    query = filtrar_periodo(query_producoes(), Producao.produzido_em, data_inicio, data_fim)
    if produto_id is not None:
        query = query.where(Producao.produto_id == produto_id)
    query = query.order_by(col(Producao.produzido_em).desc()).limit(limit).offset(offset)

    result = await db.exec(query)
    return [montar_producao_response(*linha) for linha in result.all()]


async def consumir_por_tipo(db: AsyncSession, tipo: TipoIngrediente, quantidade: Decimal, descricao: str) -> Decimal:
    """Desconta <quantidade> dos ingredientes ativos do <tipo>, do cadastrado há mais tempo para o mais
    recente, e devolve o custo do que foi consumido"""
    result = await db.exec(
        select(Ingrediente)
        .where(Ingrediente.tipo == tipo, Ingrediente.ativo == True)  # noqa: E712
        .order_by(Ingrediente.created_at, Ingrediente.id)
        .with_for_update()
    )
    ingredientes = result.all()
    disponivel = sum((i.quantidade_estoque for i in ingredientes), Decimal(0))
    if quantidade > disponivel:
        regra_de_negocio(f"Estoque de {descricao} insuficiente: disponível {disponivel.normalize():f}, "
                         f"necessário {Decimal(quantidade).normalize():f}.")

    custo = Decimal(0)
    for ingrediente, abatido in zip(ingredientes, distribuir_fifo(quantidade, [i.quantidade_estoque for i in ingredientes])):
        custo += abatido * ingrediente.custo_unitario
        ingrediente.quantidade_estoque -= abatido
        db.add(ingrediente)
    return custo


async def registrar_producao(db: AsyncSession, producao_create: ProducaoCreate, usuario_id: UUID) -> ProducaoResponse:
    """Desconta a polpa do produto, o açúcar e uma garrafa PET por unidade (açúcar e garrafas do lote
    mais antigo para o mais novo), soma a quantidade produzida ao estoque do produto e atualiza o custo
    médio dele."""
    result = await db.exec(select(Produto).where(Produto.id == producao_create.produto_id).with_for_update())
    produto = result.one_or_none()
    if not produto:
        instancia_nao_encontrada("Produto")
    if produto.ingrediente_id is None:
        regra_de_negocio(f"{produto.nome} não tem polpa cadastrada, então não é produzido na loja.")

    result = await db.exec(select(Ingrediente).where(Ingrediente.id == produto.ingrediente_id).with_for_update())
    polpa = result.one()
    if polpa.quantidade_estoque < producao_create.polpa_usada:
        regra_de_negocio(f"Estoque de {polpa.nome} insuficiente: disponível "
                         f"{polpa.quantidade_estoque} {polpa.unidade_medida.value}.")

    garrafas_usadas = producao_create.quantidade_produzida
    custo_acucar = await consumir_por_tipo(db, TipoIngrediente.ACUCAR, producao_create.acucar_usado, "açúcar (kg)")
    custo_garrafas = await consumir_por_tipo(db, TipoIngrediente.GARRAFA, Decimal(garrafas_usadas), "garrafas PET")

    custo_total = arredondar_dinheiro(producao_create.polpa_usada * polpa.custo_unitario + custo_acucar + custo_garrafas)
    polpa.quantidade_estoque -= producao_create.polpa_usada
    db.add(polpa)

    produto.custo_unitario = calcular_custo_medio(produto.quantidade_estoque, produto.custo_unitario,
                                                  producao_create.quantidade_produzida, custo_total)
    produto.quantidade_estoque += producao_create.quantidade_produzida
    db.add(produto)

    producao = Producao(**producao_create.model_dump(), usuario_id=usuario_id, custo_total=custo_total,
                        garrafas_usadas=garrafas_usadas)
    db.add(producao)
    await db.commit()

    result = await db.exec(query_producoes().where(Producao.id == producao.id))
    return montar_producao_response(*result.one())
