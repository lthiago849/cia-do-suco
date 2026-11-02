.PHONY: up down restart logs env test demo reset-db

up:
	docker compose -f docker_compose.yml up -d --build
down:
	docker compose -f docker_compose.yml down

restart:
	docker compose -f docker_compose.yml down && docker compose -f docker_compose.yml up -d --build

logs:
	docker compose -f docker_compose.yml logs -f

env:
	cp .env.example app/.env

test:
	docker compose -f docker_compose.yml exec app poetry run pytest /tests

# Apaga TODOS os dados do banco local e recria as tabelas (só para desenvolvimento)
reset-db:
	docker compose -f docker_compose.yml down -v && docker compose -f docker_compose.yml up -d --build

# Popula um banco recém-criado com 60 dias de dados falsos de demonstração
demo:
	docker compose -f docker_compose.yml exec app poetry run python scripts/popular_demo.py
