from uuid import UUID
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.controllers.descarte_estoque import listar_descartes, registrar_descarte
from app.controllers.entrada_estoque import listar_entradas, registrar_entrada
from app.controllers.producao import listar_producoes, registrar_producao
from app.db.db import get_session
from app.schemas.auth import UsuarioOut
from app.schemas.descarte_estoque import DescarteCreate, DescarteResponse
from app.schemas.entrada_estoque import EntradaEstoqueCreate, EntradaEstoqueResponse
from app.schemas.producao import ProducaoCreate, ProducaoResponse
from app.security.permissoes import ocultar_custos
from app.security.auth import get_current_user

router = APIRouter(tags=["Estoque"])


@router.get("/entradas-estoque/", response_model=list[EntradaEstoqueResponse])
async def listar_entradas_endpoint(data_inicio: Optional[date] = None, data_fim: Optional[date] = None,
                                   ingrediente_id: Optional[UUID] = None, produto_id: Optional[UUID] = None,
                                   limit: int = Query(default=100, le=500), offset: int = 0,
                                   db: AsyncSession = Depends(get_session),
                                   current_user: UsuarioOut = Depends(get_current_user)):
    return ocultar_custos(await listar_entradas(db, data_inicio, data_fim, ingrediente_id, produto_id,
                                                  limit, offset), current_user)


@router.post("/entradas-estoque/", response_model=EntradaEstoqueResponse, status_code=status.HTTP_201_CREATED)
async def registrar_entrada_endpoint(entrada_create: EntradaEstoqueCreate, db: AsyncSession = Depends(get_session),
                                     current_user: UsuarioOut = Depends(get_current_user)):
    """Compra de ingrediente ou de produto pronto: soma ao estoque e recalcula o custo médio"""
    return ocultar_custos(await registrar_entrada(db, entrada_create, current_user.id), current_user)


@router.get("/producoes/", response_model=list[ProducaoResponse])
async def listar_producoes_endpoint(data_inicio: Optional[date] = None, data_fim: Optional[date] = None,
                                    produto_id: Optional[UUID] = None,
                                    limit: int = Query(default=100, le=500), offset: int = 0,
                                    db: AsyncSession = Depends(get_session),
                                    current_user: UsuarioOut = Depends(get_current_user)):
    return ocultar_custos(await listar_producoes(db, data_inicio, data_fim, produto_id, limit, offset), current_user)


@router.post("/producoes/", response_model=ProducaoResponse, status_code=status.HTTP_201_CREATED)
async def registrar_producao_endpoint(producao_create: ProducaoCreate, db: AsyncSession = Depends(get_session),
                                      current_user: UsuarioOut = Depends(get_current_user)):
    return ocultar_custos(await registrar_producao(db, producao_create, current_user.id), current_user)


@router.get("/descartes/", response_model=list[DescarteResponse])
async def listar_descartes_endpoint(data_inicio: Optional[date] = None, data_fim: Optional[date] = None,
                                    limit: int = Query(default=100, le=500), offset: int = 0,
                                    db: AsyncSession = Depends(get_session),
                                    current_user: UsuarioOut = Depends(get_current_user)):
    return ocultar_custos(await listar_descartes(db, data_inicio, data_fim, limit, offset), current_user)


@router.post("/descartes/", response_model=DescarteResponse, status_code=status.HTTP_201_CREATED)
async def registrar_descarte_endpoint(descarte_create: DescarteCreate, db: AsyncSession = Depends(get_session),
                                      current_user: UsuarioOut = Depends(get_current_user)):
    """Ingrediente ou produto jogado fora (garrafas sujas demais, suco que estragou...). O custo dele é repassado
    ao que sobrou no estoque."""
    return ocultar_custos(await registrar_descarte(db, descarte_create, current_user.id), current_user)
