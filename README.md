# Cia do Suco

Sistema da loja: vendas, estoque, produção, entregas, fiado e relatórios.

| Pasta | O que é |
|---|---|
| [`loja-sucos-backend/`](loja-sucos-backend/README.md) | API em FastAPI + PostgreSQL (migrações com Flyway), roda em Docker |
| [`loja-sucos-frontend/`](loja-sucos-frontend/README.md) | Telas em React + Vite, pensadas para o celular |

## Rodar local

```bash
cd loja-sucos-backend && cp .env.example app/.env && make up   # API em http://localhost:8000
cd loja-sucos-frontend && npm install && npm run dev -- --port 5173
```

## Produção

https://ciadosuco.duckdns.org — publicado com `CHAVE=/caminho/da/chave ./loja-sucos-backend/deploy.sh`
(faz backup do banco antes, roda as migrações e publica backend e frontend).

Arquivos `.env` (senhas) **nunca** entram no repositório.
