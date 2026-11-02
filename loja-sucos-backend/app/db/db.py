from typing import AsyncGenerator

from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.const.url import DATABASE_URL

# As tabelas são criadas pelas migrations do Flyway (app/migrations/versions)
async_engine = create_async_engine(DATABASE_URL, future=True)

async_session = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)


# Gerador de sessão assíncrona
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    # Inicia uma sessão assíncrona e a fornece ao contexto chamador
    async with async_session() as session:
        yield session
