from uuid import UUID
from typing import Optional

from sqlalchemy import update, func
from sqlalchemy.exc import IntegrityError
from sqlmodel import select, or_, and_, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.exceptions.db import instancia_nao_encontrada, erro_de_integridade_sql
from app.exceptions.genericos import regra_de_negocio
from app.models.cliente import Cliente
from app.models.endereco_cliente import EnderecoCliente
from app.schemas.cliente import (
    ClienteCreate, ClienteUpdate, ClienteResponse, EnderecoCreate, EnderecoResponse
)
from app.utils.fiado import subquery_saldo_por_cliente
from app.utils.generic_db_operations import atualizar_instancia
from app.validations.validar_horario import validar_horario


def query_clientes():
    saldos = subquery_saldo_por_cliente()
    return (
        select(Cliente, EnderecoCliente, func.coalesce(saldos.c.saldo, 0).label("saldo"))
        .outerjoin(EnderecoCliente, and_(EnderecoCliente.cliente_id == Cliente.id, EnderecoCliente.ativo == True))  # noqa: E712
        .outerjoin(saldos, saldos.c.cliente_id == Cliente.id)
    )


def montar_cliente_response(cliente: Cliente, endereco: Optional[EnderecoCliente], saldo) -> ClienteResponse:
    return ClienteResponse.model_validate({
        **cliente.model_dump(),
        "endereco_atual": EnderecoResponse.model_validate(endereco) if endereco else None,
        "saldo_fiado": saldo,
    })


async def listar_clientes(db: AsyncSession, busca: Optional[str] = None, ativo: Optional[bool] = None,
                          limit: int = 100, offset: int = 0) -> list[ClienteResponse]:
    query = query_clientes().order_by(Cliente.nome)
    if busca:
        filtros = [col(Cliente.nome).ilike(f"%{busca}%")]
        digitos = "".join(c for c in busca if c.isdigit())
        if digitos:
            filtros.append(col(Cliente.telefone).contains(digitos))
        query = query.where(or_(*filtros))
    if ativo is not None:
        query = query.where(Cliente.ativo == ativo)

    result = await db.exec(query.limit(limit).offset(offset))
    return [montar_cliente_response(*linha) for linha in result.all()]


async def get_cliente_by_id(db: AsyncSession, id_cliente: UUID) -> ClienteResponse:
    result = await db.exec(query_clientes().where(Cliente.id == id_cliente))
    linha = result.one_or_none()
    if not linha:
        instancia_nao_encontrada("Cliente")
    return montar_cliente_response(*linha)


async def criar_cliente(db: AsyncSession, cliente_create: ClienteCreate) -> ClienteResponse:
    db_cliente = Cliente(**cliente_create.model_dump(exclude={"endereco"}))
    db.add(db_cliente)

    try:
        await db.flush()
        if cliente_create.endereco:
            db.add(EnderecoCliente(**cliente_create.endereco.model_dump(), cliente_id=db_cliente.id,
                                   confirmado_em=validar_horario()))
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        erro_de_integridade_sql(e)

    return await get_cliente_by_id(db, db_cliente.id)


async def atualizar_cliente(db: AsyncSession, cliente_update: ClienteUpdate, id_cliente: UUID) -> ClienteResponse:
    cliente = await db.get(Cliente, id_cliente)
    if not cliente:
        instancia_nao_encontrada("Cliente")

    await atualizar_instancia(cliente, cliente_update)
    db.add(cliente)

    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        erro_de_integridade_sql(e)

    return await get_cliente_by_id(db, id_cliente)


async def listar_enderecos(db: AsyncSession, id_cliente: UUID) -> list[EnderecoResponse]:
    if not await db.get(Cliente, id_cliente):
        instancia_nao_encontrada("Cliente")

    result = await db.exec(
        select(EnderecoCliente)
        .where(EnderecoCliente.cliente_id == id_cliente)
        .order_by(col(EnderecoCliente.ativo).desc(), col(EnderecoCliente.created_at).desc())
    )
    return [EnderecoResponse.model_validate(e) for e in result.all()]


async def cadastrar_endereco(db: AsyncSession, id_cliente: UUID, endereco_create: EnderecoCreate) -> EnderecoResponse:
    """O novo endereço vira o atual; o anterior fica no histórico como inativo"""
    if not await db.get(Cliente, id_cliente):
        instancia_nao_encontrada("Cliente")

    await db.execute(
        update(EnderecoCliente)
        .where(EnderecoCliente.cliente_id == id_cliente, EnderecoCliente.ativo == True)  # noqa: E712
        .values(ativo=False, updated_at=validar_horario())
    )
    endereco = EnderecoCliente(**endereco_create.model_dump(), cliente_id=id_cliente, confirmado_em=validar_horario())
    db.add(endereco)
    await db.commit()
    await db.refresh(endereco)
    return EnderecoResponse.model_validate(endereco)


async def confirmar_endereco(db: AsyncSession, id_cliente: UUID, id_endereco: UUID) -> EnderecoResponse:
    """Registra que o cliente confirmou que ainda mora no endereço atual"""
    endereco = await db.get(EnderecoCliente, id_endereco)
    if not endereco or endereco.cliente_id != id_cliente:
        instancia_nao_encontrada("Endereco")
    if not endereco.ativo:
        regra_de_negocio("Só o endereço atual pode ser confirmado. Cadastre um novo endereço.")

    endereco.confirmado_em = validar_horario()
    db.add(endereco)
    await db.commit()
    await db.refresh(endereco)
    return EnderecoResponse.model_validate(endereco)
