import asyncio
import sys
import os

# Adiciona o diretório pai ao sys.path para permitir imports do pacote 'app'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv  # noqa: E402
from sqlmodel import select  # noqa: E402

from app.db.db import get_session  # noqa: E402
from app.models.usuario import Usuario  # noqa: E402
from app.const.enums import TipoUsuario  # noqa: E402
from app.security.auth import get_hash  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))


async def init_user():
    async for session in get_session():
        # Só cria o admin no primeiro start (quando não há nenhum usuário)
        result = await session.exec(select(Usuario))
        if result.first():
            print("Já existe um usuário cadastrado. Nenhuma ação necessária.")
            return

        admin_user = Usuario(
            nome_usuario=os.getenv("ADMIN_LOGIN", "admin"),
            nome=os.getenv("ADMIN_NOME", "Administrador"),
            email=os.getenv("ADMIN_EMAIL", "admin@lojasucos.com"),
            senha=get_hash(os.getenv("ADMIN_PASSWORD", "Admin@123")),
            tipo=TipoUsuario.ADMIN,
            # O e-mail do .env pode ser de exemplo: o admin marca para receber o relatório depois de conferir
            recebe_relatorio=False,
        )

        session.add(admin_user)
        await session.commit()

        print(f"Usuário inicial criado: {admin_user.nome_usuario} ({admin_user.email})")


if __name__ == "__main__":
    asyncio.run(init_user())
