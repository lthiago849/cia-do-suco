from uuid import UUID
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.const.enums import TipoUsuario


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class UsuarioOut(BaseModel):
    id: UUID
    nome_usuario: str
    nome: str
    email: str
    tipo: TipoUsuario
    telefone: Optional[str] = None
    recebe_relatorio: bool = True
    ativo: bool

    model_config = ConfigDict(from_attributes=True)
