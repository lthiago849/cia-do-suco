import os
import bcrypt

from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.const.enums import TipoUsuario
from app.schemas.auth import UsuarioOut
from app.models.usuario import Usuario
from app.db.db import get_session
from app.const.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRES_MINUTES
from app.exceptions.genericos import sem_permissao

CREDENTIAL_EXCEPTION = HTTPException(
    status_code=401,
    detail="Não pôde validar as credenciais",
    headers={"WWW-Authenticate": "Bearer"}
)

path = os.getenv("BASEPATH", "")

oauth_scheme = OAuth2PasswordBearer(tokenUrl=f"{path}/users/token")


def get_hash(plain: str) -> str:
    """Retorna o hash bcrypt de uma string <plain>"""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_text: str, hash_text: str) -> bool:
    """Compara a senha <plain_text> com o hash do banco de dados"""
    try:
        return bcrypt.checkpw(plain_text.encode("utf-8"), hash_text.encode("utf-8"))
    except ValueError:
        # Hash malformado
        return False


async def get_user(username: str, session: AsyncSession) -> Usuario | None:
    result = await session.exec(select(Usuario).where(Usuario.nome_usuario == username))
    return result.one_or_none()


async def authenticate_user(username: str, plain: str, session: AsyncSession) -> Usuario | None:
    """Autentica o usuário <username> com a senha <plain>. Usuários inativos não entram."""
    user = await get_user(username, session)
    if not user or not user.ativo:
        return None

    if not verify_password(plain, user.senha):
        return None

    return user


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRES_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(session: AsyncSession = Depends(get_session),
                           token: str = Depends(oauth_scheme)) -> UsuarioOut:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise CREDENTIAL_EXCEPTION

    username: str | None = payload.get("sub")
    if username is None:
        raise CREDENTIAL_EXCEPTION

    user = await get_user(username, session)
    if user is None or not user.ativo:
        raise CREDENTIAL_EXCEPTION

    return UsuarioOut.model_validate(user)


async def get_current_admin(current_user: UsuarioOut = Depends(get_current_user)) -> UsuarioOut:
    if current_user.tipo != TipoUsuario.ADMIN:
        sem_permissao()
    return current_user
