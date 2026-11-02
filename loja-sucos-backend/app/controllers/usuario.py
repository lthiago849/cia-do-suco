from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.exceptions.db import instancia_nao_encontrada, erro_de_integridade_sql
from app.exceptions.genericos import regra_de_negocio
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCreate, UsuarioUpdate, UsuarioResponse, MembroEquipe
from app.security.auth import get_hash


async def listar_usuarios(db: AsyncSession) -> list[UsuarioResponse]:
    result = await db.exec(select(Usuario).order_by(Usuario.nome))
    return [UsuarioResponse.model_validate(u) for u in result.all()]


async def listar_equipe(db: AsyncSession) -> list[MembroEquipe]:
    result = await db.exec(select(Usuario).where(Usuario.ativo == True).order_by(Usuario.nome))  # noqa: E712
    return [MembroEquipe(id=u.id, nome=u.nome) for u in result.all()]


async def criar_usuario(db: AsyncSession, usuario_create: UsuarioCreate) -> UsuarioResponse:
    dados = usuario_create.model_dump()
    dados["senha"] = get_hash(dados["senha"])
    db_usuario = Usuario(**dados)
    db.add(db_usuario)

    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        erro_de_integridade_sql(e)

    await db.refresh(db_usuario)
    return UsuarioResponse.model_validate(db_usuario)


async def atualizar_usuario(db: AsyncSession, usuario_update: UsuarioUpdate,
                            id_usuario: UUID, id_usuario_logado: UUID) -> UsuarioResponse:
    usuario = await db.get(Usuario, id_usuario)
    if not usuario:
        instancia_nao_encontrada("Usuario")

    dados = usuario_update.model_dump(exclude_unset=True)

    # Impede o admin de se trancar fora do sistema
    if id_usuario == id_usuario_logado and (dados.get("ativo") is False or dados.get("tipo") not in (None, usuario.tipo)):
        regra_de_negocio("Você não pode desativar nem rebaixar o seu próprio usuário.")

    if dados.get("senha"):
        dados["senha"] = get_hash(dados["senha"])
    else:
        dados.pop("senha", None)

    for key, value in dados.items():
        setattr(usuario, key, value)

    db.add(usuario)
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        erro_de_integridade_sql(e)

    await db.refresh(usuario)
    return UsuarioResponse.model_validate(usuario)
