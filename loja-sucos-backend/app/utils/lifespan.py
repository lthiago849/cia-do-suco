import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db.db import async_engine
from app.services.relatorio_estoque import agendador_relatorio_estoque

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan é uma função executada no ínicio e no fim de um processo do fastapi. As funções que estão
    antes do yield serão executadas no ínicio, as que estão após serão executadas ao finalizar o processo"""

    # Relatório de estoque das 8h por e-mail
    agendador = asyncio.create_task(agendador_relatorio_estoque())

    yield

    agendador.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await agendador
    await async_engine.dispose()
    logger.info("Conexões com o banco encerradas.")
