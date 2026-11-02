from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.controllers.fiado import listar_devedores, get_extrato, registrar_pagamento
from app.db.db import get_session
from app.schemas.auth import UsuarioOut
from app.schemas.fiado import PagamentoFiadoCreate, PagamentoFiadoResponse, DevedorResponse, ExtratoFiadoResponse
from app.security.permissoes import ocultar_custos
from app.security.auth import get_current_user

router = APIRouter(prefix="/fiado", tags=["Fiado"])


@router.get("/devedores", response_model=list[DevedorResponse])
async def listar_devedores_endpoint(db: AsyncSession = Depends(get_session),
                                    _: UsuarioOut = Depends(get_current_user)):
    """Clientes com fiado em aberto, maior saldo primeiro"""
    return await listar_devedores(db)


@router.get("/clientes/{id_cliente}", response_model=ExtratoFiadoResponse)
async def get_extrato_endpoint(id_cliente: UUID, db: AsyncSession = Depends(get_session),
                               current_user: UsuarioOut = Depends(get_current_user)):
    return ocultar_custos(await get_extrato(db, id_cliente), current_user)


@router.post("/pagamentos", response_model=PagamentoFiadoResponse, status_code=status.HTTP_201_CREATED)
async def registrar_pagamento_endpoint(pagamento_create: PagamentoFiadoCreate,
                                       db: AsyncSession = Depends(get_session),
                                       current_user: UsuarioOut = Depends(get_current_user)):
    """Abate o valor das compras fiado em aberto, da mais antiga para a mais nova"""
    return ocultar_custos(await registrar_pagamento(db, pagamento_create, current_user.id), current_user)
