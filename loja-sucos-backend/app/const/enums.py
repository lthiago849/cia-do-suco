from enum import Enum

from sqlalchemy import Enum as SAEnum


# Os nomes dos membros são iguais aos valores: o SQLAlchemy grava o nome do membro no banco.
class TipoUsuario(str, Enum):
    ADMIN = "ADMIN"
    ATENDENTE = "ATENDENTE"


class CategoriaProduto(str, Enum):
    SUCO = "SUCO"
    PICOLE = "PICOLE"
    MORENINHA = "MORENINHA"
    CREMOSINHO = "CREMOSINHO"


class TipoIngrediente(str, Enum):
    POLPA = "POLPA"
    FRUTA = "FRUTA"
    ACUCAR = "ACUCAR"
    GARRAFA = "GARRAFA"
    OUTRO = "OUTRO"


class StatusPedido(str, Enum):
    NOVO = "NOVO"
    ENTREGUE = "ENTREGUE"
    CANCELADO = "CANCELADO"


class OrigemPedido(str, Enum):
    WHATSAPP = "WHATSAPP"
    ATENDENTE = "ATENDENTE"


class CondicaoGarrafa(str, Enum):
    LIMPA = "LIMPA"
    SUJA = "SUJA"


class UnidadeMedida(str, Enum):
    KG = "KG"
    L = "L"
    UN = "UN"


class FormaPagamento(str, Enum):
    PIX = "PIX"
    DINHEIRO = "DINHEIRO"
    DEBITO = "DEBITO"
    CREDITO = "CREDITO"
    FIADO = "FIADO"


def pg_enum(enum_cls: type[Enum], nome_tipo: str) -> SAEnum:
    """Mapeia o enum Python para o tipo ENUM já criado pela migration <nome_tipo>"""
    return SAEnum(enum_cls, name=nome_tipo)
