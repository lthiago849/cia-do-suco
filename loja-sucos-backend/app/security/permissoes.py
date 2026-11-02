from pydantic import BaseModel

from app.const.enums import TipoUsuario
from app.schemas.auth import UsuarioOut

# Campos que revelam custo/lucro. Só o administrador recebe esses valores.
CAMPOS_RESTRITOS_ADMIN = {"custo_unitario", "custo_total", "taxa_pagamento", "valor_perdido", "ultimo_custo_compra"}


def ocultar_custos(resposta, usuario: UsuarioOut):
    """Para quem não é admin, esvazia os campos de custo, taxa e perda da resposta (inclusive em listas e
    objetos aninhados, como os itens de uma venda). Preço de venda e quantidades continuam visíveis."""
    if usuario.tipo == TipoUsuario.ADMIN:
        return resposta
    if isinstance(resposta, list):
        return [ocultar_custos(item, usuario) for item in resposta]
    if not isinstance(resposta, BaseModel):
        return resposta

    atualizacao = {}
    for campo in type(resposta).model_fields:
        valor = getattr(resposta, campo)
        if campo in CAMPOS_RESTRITOS_ADMIN:
            atualizacao[campo] = None
        elif isinstance(valor, (BaseModel, list)):
            atualizacao[campo] = ocultar_custos(valor, usuario)
    return resposta.model_copy(update=atualizacao)
