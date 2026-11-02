from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.const.enums import TipoIngrediente
from app.controllers.ingrediente import (
    listar_ingredientes, get_ingrediente_by_id, criar_ingrediente, atualizar_ingrediente,
    excluir_ingrediente
)
from app.db.db import get_session
from app.schemas.auth import UsuarioOut
from app.schemas.ingrediente import IngredienteCreate, IngredienteUpdate, IngredienteResponse
from app.security.permissoes import ocultar_custos
from app.security.auth import get_current_user, get_current_admin

router = APIRouter(prefix="/ingredientes", tags=["Ingredientes"])


@router.get("/", response_model=list[IngredienteResponse])
async def listar_ingredientes_endpoint(tipo: Optional[TipoIngrediente] = None, ativo: Optional[bool] = None,
                                       db: AsyncSession = Depends(get_session),
                                       current_user: UsuarioOut = Depends(get_current_user)):
    return ocultar_custos(await listar_ingredientes(db, tipo, ativo), current_user)


@router.get("/{id_ingrediente}", response_model=IngredienteResponse)
async def get_ingrediente_endpoint(id_ingrediente: UUID, db: AsyncSession = Depends(get_session),
                                   current_user: UsuarioOut = Depends(get_current_user)):
    return ocultar_custos(await get_ingrediente_by_id(db, id_ingrediente), current_user)


@router.post("/", response_model=IngredienteResponse, status_code=status.HTTP_201_CREATED)
async def criar_ingrediente_endpoint(ingrediente_create: IngredienteCreate, db: AsyncSession = Depends(get_session),
                                     _: UsuarioOut = Depends(get_current_admin)):
    return await criar_ingrediente(db, ingrediente_create)


@router.put("/{id_ingrediente}", response_model=IngredienteResponse)
async def atualizar_ingrediente_endpoint(id_ingrediente: UUID, ingrediente_update: IngredienteUpdate,
                                         db: AsyncSession = Depends(get_session),
                                         _: UsuarioOut = Depends(get_current_admin)):
    return await atualizar_ingrediente(db, ingrediente_update, id_ingrediente)


@router.delete("/{id_ingrediente}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_ingrediente_endpoint(id_ingrediente: UUID, db: AsyncSession = Depends(get_session),
                                       _: UsuarioOut = Depends(get_current_admin)):
    """Apaga um ingrediente que nunca foi usado. Com compras, descartes ou produto ligado: 409 (desative)."""
    await excluir_ingrediente(db, id_ingrediente)
