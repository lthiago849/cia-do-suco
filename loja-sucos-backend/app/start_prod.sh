#!/bin/sh
# Início da API em produção: espera as migrations, cria o admin (só no primeiro start) e sobe sem --reload
set -e

python - <<'PY'
import asyncio, os, time
import asyncpg

async def esperar():
    for _ in range(120):
        try:
            conexao = await asyncpg.connect(host="db", user=os.environ["POSTGRES_USER"],
                                            password=os.environ["POSTGRES_PASSWORD"],
                                            database=os.environ["POSTGRES_DB"])
            try:
                await conexao.fetchval("SELECT 1 FROM usuario LIMIT 1")
                return
            finally:
                await conexao.close()
        except Exception:
            print("Aguardando banco e migrations...")
            time.sleep(2)
    raise SystemExit("O banco não ficou pronto a tempo")

asyncio.run(esperar())
PY

python init_user.py
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir ../ \
    --root-path "${BASEPATH}" --proxy-headers --forwarded-allow-ips="*"
