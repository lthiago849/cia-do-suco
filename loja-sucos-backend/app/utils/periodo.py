from datetime import date
from typing import Optional

from sqlalchemy import func

from app.const.config import TIMEZONE_LOJA


def horario_local(coluna):
    """Converte uma coluna TIMESTAMPTZ para o horário da loja (timestamp sem fuso)"""
    return func.timezone(TIMEZONE_LOJA, coluna)


def data_local(coluna):
    return func.date(horario_local(coluna))


def filtrar_periodo(query, coluna, data_inicio: Optional[date], data_fim: Optional[date]):
    """Filtra <coluna> pelos dias (no fuso da loja) entre <data_inicio> e <data_fim>, inclusive"""
    if data_inicio is not None:
        query = query.where(data_local(coluna) >= data_inicio)
    if data_fim is not None:
        query = query.where(data_local(coluna) <= data_fim)
    return query
