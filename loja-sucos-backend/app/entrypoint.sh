#!/bin/sh

# Dep install
if [ -f "pyproject.toml" ]; then
    echo "Installing dependencies from pyproject.toml"
    pip install poetry
    poetry install
else
    echo "pyproject.toml not found, skipping dependency installation."
fi

# PG
echo "Waiting for PostgreSQL to be ready"
until pg_isready -h db -p 5432 -U postgres > /dev/null 2>&1; do
    echo "Waiting for PostgreSQL to be ready"
    sleep 1
done

echo "PostgreSQL is ready"

# Flyway: espera a tabela usuario existir antes de criar o admin
echo "Waiting for Flyway migrations"
until PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h db -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-LOJASUCOSDB}" \
    -tAc "SELECT 1 FROM usuario LIMIT 1" > /dev/null 2>&1; do
    echo "Waiting for Flyway migrations"
    sleep 2
done

# Init user
echo "Initializing user"
poetry run python init_user.py || { echo "User initialization failed"; exit 1; }

# Fastapi
echo "Starting FastAPI server"
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir ../ --reload || { echo "FastAPI failed"; exit 1; }
