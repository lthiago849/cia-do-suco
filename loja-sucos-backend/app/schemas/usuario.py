from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.const.enums import TipoUsuario
from app.schemas.auth import UsuarioOut
from app.validations.telefone import normalizar_telefone
from app.validations.usuario import validar_senha


class UsuarioCreate(BaseModel):
    nome_usuario: str = Field(min_length=3, max_length=255)
    nome: str = Field(min_length=1, max_length=255)
    email: EmailStr
    senha: str
    tipo: TipoUsuario = TipoUsuario.ATENDENTE
    telefone: Optional[str] = None
    recebe_relatorio: bool = True

    @field_validator("senha")
    def validar_senha(cls, senha):
        return validar_senha(senha)

    @field_validator("telefone")
    def validar_telefone(cls, telefone):
        return normalizar_telefone(telefone)


class UsuarioUpdate(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    senha: Optional[str] = None
    tipo: Optional[TipoUsuario] = None
    telefone: Optional[str] = None
    recebe_relatorio: Optional[bool] = None
    ativo: Optional[bool] = None

    @field_validator("senha")
    def validar_senha(cls, senha):
        return validar_senha(senha)

    @field_validator("telefone")
    def validar_telefone(cls, telefone):
        return normalizar_telefone(telefone)


class MembroEquipe(BaseModel):
    """Só o nome, para qualquer funcionário escolher o entregador"""
    id: UUID
    nome: str


class UsuarioResponse(UsuarioOut):
    created_at: datetime
