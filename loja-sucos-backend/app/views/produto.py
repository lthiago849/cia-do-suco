from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.const.enums import CategoriaProduto
from app.controllers.produto import listar_produtos, get_produto_by_id, criar_produto, atualizar_produto
from app.db.db import get_session
from app.schemas.auth import UsuarioOut
from app.schemas.produto import ProdutoCreate, ProdutoUpdate, ProdutoResponse
from app.security.permissoes import ocultar_custos
from app.security.auth import get_current_user, get_current_admin

router = APIRouter(prefix="/produtos", tags=["Produtos"])


@router.get("/", response_model=list[ProdutoResponse])
async def listar_produtos_endpoint(categoria: Optional[CategoriaProduto] = None, ativo: Optional[bool] = None,
                                   busca: Optional[str] = None, db: AsyncSession = Depends(get_session),
                                   current_user: UsuarioOut = Depends(get_current_user)):
    return ocultar_custos(await listar_produtos(db, categoria, ativo, busca), current_user)


@router.get("/{id_produto}", response_model=ProdutoResponse)
async def get_produto_endpoint(id_produto: UUID, db: AsyncSession = Depends(get_session),
                               current_user: UsuarioOut = Depends(get_current_user)):
    return ocultar_custos(await get_produto_by_id(db, id_produto), current_user)


@router.post("/", response_model=ProdutoResponse, status_code=status.HTTP_201_CREATED)
async def criar_produto_endpoint(produto_create: ProdutoCreate, db: AsyncSession = Depends(get_session),
                                 _: UsuarioOut = Depends(get_current_admin)):
    return await criar_produto(db, produto_create)


@router.put("/{id_produto}", response_model=ProdutoResponse)
async def atualizar_produto_endpoint(id_produto: UUID, produto_update: ProdutoUpdate,
                                     db: AsyncSession = Depends(get_session),
                                     _: UsuarioOut = Depends(get_current_admin)):
    return await atualizar_produto(db, produto_update, id_produto)
