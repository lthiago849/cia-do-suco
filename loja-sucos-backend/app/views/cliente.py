from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.controllers.cliente import (
    listar_clientes, get_cliente_by_id, criar_cliente, atualizar_cliente,
    listar_enderecos, cadastrar_endereco, confirmar_endereco
)
from app.db.db import get_session
from app.schemas.auth import UsuarioOut
from app.schemas.cliente import ClienteCreate, ClienteUpdate, ClienteResponse, EnderecoCreate, EnderecoResponse
from app.security.auth import get_current_user

router = APIRouter(prefix="/clientes", tags=["Clientes"])


@router.get("/", response_model=list[ClienteResponse])
async def listar_clientes_endpoint(busca: Optional[str] = None, ativo: Optional[bool] = None,
                                   limit: int = Query(default=100, le=500), offset: int = 0,
                                   db: AsyncSession = Depends(get_session),
                                   _: UsuarioOut = Depends(get_current_user)):
    """<busca> procura no nome e no telefone"""
    return await listar_clientes(db, busca, ativo, limit, offset)


@router.get("/{id_cliente}", response_model=ClienteResponse)
async def get_cliente_endpoint(id_cliente: UUID, db: AsyncSession = Depends(get_session),
                               _: UsuarioOut = Depends(get_current_user)):
    return await get_cliente_by_id(db, id_cliente)


@router.post("/", response_model=ClienteResponse, status_code=status.HTTP_201_CREATED)
async def criar_cliente_endpoint(cliente_create: ClienteCreate, db: AsyncSession = Depends(get_session),
                                 _: UsuarioOut = Depends(get_current_user)):
    return await criar_cliente(db, cliente_create)


@router.put("/{id_cliente}", response_model=ClienteResponse)
async def atualizar_cliente_endpoint(id_cliente: UUID, cliente_update: ClienteUpdate,
                                     db: AsyncSession = Depends(get_session),
                                     _: UsuarioOut = Depends(get_current_user)):
    return await atualizar_cliente(db, cliente_update, id_cliente)


@router.get("/{id_cliente}/enderecos", response_model=list[EnderecoResponse])
async def listar_enderecos_endpoint(id_cliente: UUID, db: AsyncSession = Depends(get_session),
                                    _: UsuarioOut = Depends(get_current_user)):
    """Endereço atual primeiro, depois o histórico"""
    return await listar_enderecos(db, id_cliente)


@router.post("/{id_cliente}/enderecos", response_model=EnderecoResponse, status_code=status.HTTP_201_CREATED)
async def cadastrar_endereco_endpoint(id_cliente: UUID, endereco_create: EnderecoCreate,
                                      db: AsyncSession = Depends(get_session),
                                      _: UsuarioOut = Depends(get_current_user)):
    """O novo endereço passa a ser o atual e o anterior vai para o histórico"""
    return await cadastrar_endereco(db, id_cliente, endereco_create)


@router.post("/{id_cliente}/enderecos/{id_endereco}/confirmar", response_model=EnderecoResponse)
async def confirmar_endereco_endpoint(id_cliente: UUID, id_endereco: UUID, db: AsyncSession = Depends(get_session),
                                      _: UsuarioOut = Depends(get_current_user)):
    return await confirmar_endereco(db, id_cliente, id_endereco)
