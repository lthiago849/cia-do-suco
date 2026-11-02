from sqlalchemy import and_, func
from sqlmodel import select, col

from app.const.enums import FormaPagamento
from app.models.venda import Venda


def saldo_venda():
    """Quanto falta pagar de uma venda: produtos + taxa de entrega - já pago"""
    return Venda.valor_total + Venda.taxa_entrega - Venda.valor_pago


def condicao_fiado_aberto():
    """Vendas fiado não canceladas que ainda não foram totalmente pagas"""
    return and_(
        Venda.forma_pagamento == FormaPagamento.FIADO,
        col(Venda.cancelada_em).is_(None),
        Venda.valor_pago < Venda.valor_total + Venda.taxa_entrega,
    )


def subquery_saldo_por_cliente():
    """cliente_id -> saldo devedor"""
    return (
        select(Venda.cliente_id, func.sum(saldo_venda()).label("saldo"))
        .where(condicao_fiado_aberto())
        .group_by(Venda.cliente_id)
        .subquery()
    )
