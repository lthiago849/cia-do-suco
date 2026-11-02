from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel.ext.asyncio.session import AsyncSession

from app.controllers.usuario import listar_usuarios, listar_equipe, criar_usuario, atualizar_usuario
from app.db.db import get_session
from app.schemas.auth import Token, UsuarioOut
from app.schemas.usuario import UsuarioCreate, UsuarioUpdate, UsuarioResponse, MembroEquipe
from app.security.auth import authenticate_user, create_access_token, get_current_user, get_current_admin

router = APIRouter(prefix="/users", tags=["Usuários"])


@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_session),
):
    user = await authenticate_user(form_data.username, form_data.password, db)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Nome de usuário ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.nome_usuario})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UsuarioOut)
async def get_me(current_user: UsuarioOut = Depends(get_current_user)):
    return current_user


@router.get("/equipe", response_model=list[MembroEquipe])
async def listar_equipe_endpoint(db: AsyncSession = Depends(get_session), _: UsuarioOut = Depends(get_current_user)):
    """Nomes dos funcionários ativos (para escolher o entregador)"""
    return await listar_equipe(db)


@router.get("/", response_model=list[UsuarioResponse])
async def listar_usuarios_endpoint(db: AsyncSession = Depends(get_session),
                                   _: UsuarioOut = Depends(get_current_admin)):
    return await listar_usuarios(db)


@router.post("/", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
async def criar_usuario_endpoint(usuario_create: UsuarioCreate, db: AsyncSession = Depends(get_session),
                                 _: UsuarioOut = Depends(get_current_admin)):
    return await criar_usuario(db, usuario_create)


@router.put("/{id_usuario}", response_model=UsuarioResponse)
async def atualizar_usuario_endpoint(id_usuario: UUID, usuario_update: UsuarioUpdate,
                                     db: AsyncSession = Depends(get_session),
                                     admin: UsuarioOut = Depends(get_current_admin)):
    return await atualizar_usuario(db, usuario_update, id_usuario, admin.id)
