from fastapi import HTTPException, status


def erro_interno_do_servidor():
    raise HTTPException(status_code=500, detail="Erro interno do servidor!")


def regra_de_negocio(msg: str):
    """Operação válida no formato, mas que viola uma regra da loja (ex.: estoque insuficiente)"""
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=msg)


def conflito(msg: str):
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)


def sem_permissao():
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                        detail="Apenas administradores podem realizar esta operação.")
