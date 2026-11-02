from uuid import UUID
from decimal import Decimal
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.comum import DecimalJson
from app.validations.telefone import normalizar_telefone


class EnderecoCreate(BaseModel):
    logradouro: Optional[str] = Field(default=None, max_length=255)
    numero: Optional[str] = Field(default=None, max_length=20)
    bairro: Optional[str] = Field(default=None, max_length=100)
    complemento: Optional[str] = Field(default=None, max_length=255)
    # Ex.: "casa da tia Maria, portão azul"
    ponto_referencia: Optional[str] = None
    latitude: Optional[Decimal] = Field(default=None, ge=-90, le=90, max_digits=9, decimal_places=6)
    longitude: Optional[Decimal] = Field(default=None, ge=-180, le=180, max_digits=9, decimal_places=6)

    @model_validator(mode="after")
    def validar_conteudo(self):
        if not (self.logradouro or self.ponto_referencia or self.latitude is not None):
            raise ValueError("Informe ao menos o logradouro, um ponto de referência ou a localização.")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude e longitude devem ser informadas juntas.")
        return self


class EnderecoResponse(BaseModel):
    id: UUID
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    bairro: Optional[str] = None
    complemento: Optional[str] = None
    ponto_referencia: Optional[str] = None
    latitude: Optional[DecimalJson] = None
    longitude: Optional[DecimalJson] = None
    ativo: bool
    confirmado_em: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClienteCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=255)
    telefone: Optional[str] = None
    observacao: Optional[str] = None
    endereco: Optional[EnderecoCreate] = None

    @field_validator("telefone")
    def validar_telefone(cls, telefone):
        return normalizar_telefone(telefone)


class ClienteUpdate(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=1, max_length=255)
    telefone: Optional[str] = None
    observacao: Optional[str] = None
    ativo: Optional[bool] = None

    @field_validator("telefone")
    def validar_telefone(cls, telefone):
        return normalizar_telefone(telefone)


class ClienteResponse(BaseModel):
    id: UUID
    nome: str
    telefone: Optional[str] = None
    observacao: Optional[str] = None
    ativo: bool
    created_at: datetime
    endereco_atual: Optional[EnderecoResponse] = None
    saldo_fiado: DecimalJson = Decimal(0)

    model_config = ConfigDict(from_attributes=True)
