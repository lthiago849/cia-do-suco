from uuid import UUID
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.const.enums import FormaPagamento
from app.controllers.venda import listar_vendas, get_venda_by_id, criar_venda, cancelar_venda
from app.db.db import get_session
from app.schemas.auth import UsuarioOut
from app.schemas.venda import VendaCreate, VendaResponse
from app.security.permissoes import ocultar_custos
from app.security.auth import get_current_user, get_current_admin

router = APIRouter(prefix="/vendas", tags=["Vendas"])


@router.get("/", response_model=list[VendaResponse])
async def listar_vendas_endpoint(data_inicio: Optional[date] = None, data_fim: Optional[date] = None,
                                 forma_pagamento: Optional[FormaPagamento] = None,
                                 cliente_id: Optional[UUID] = None, usuario_id: Optional[UUID] = None,
                                 incluir_canceladas: bool = False,
                                 limit: int = Query(default=100, le=500), offset: int = 0,
                                 db: AsyncSession = Depends(get_session),
                                 current_user: UsuarioOut = Depends(get_current_user)):
    return ocultar_custos(await listar_vendas(db, data_inicio, data_fim, forma_pagamento, cliente_id, usuario_id,
                                              incluir_canceladas, limit, offset), current_user)


@router.get("/{id_venda}", response_model=VendaResponse)
async def get_venda_endpoint(id_venda: UUID, db: AsyncSession = Depends(get_session),
                             current_user: UsuarioOut = Depends(get_current_user)):
    return ocultar_custos(await get_venda_by_id(db, id_venda), current_user)


@router.post("/", response_model=VendaResponse, status_code=status.HTTP_201_CREATED)
async def criar_venda_endpoint(venda_create: VendaCreate, db: AsyncSession = Depends(get_session),
                               current_user: UsuarioOut = Depends(get_current_user)):
    return ocultar_custos(await criar_venda(db, venda_create, current_user.id), current_user)


@router.post("/{id_venda}/cancelar", response_model=VendaResponse)
async def cancelar_venda_endpoint(id_venda: UUID, db: AsyncSession = Depends(get_session),
                                  admin: UsuarioOut = Depends(get_current_admin)):
    return await cancelar_venda(db, id_venda, admin.id)
