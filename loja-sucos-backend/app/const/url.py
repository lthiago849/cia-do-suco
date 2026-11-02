import os
from dotenv import load_dotenv

load_dotenv()

DOCKER_COMPOSE = os.getenv("DOCKER_COMPOSE")
ENV_DATABASE_URL = os.getenv("ENV_DATABASE_URL")
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5436")
POSTGRES_DB = os.getenv("POSTGRES_DB", "LOJASUCOSDB")

if ENV_DATABASE_URL:
    DATABASE_URL = f"postgresql+asyncpg://{ENV_DATABASE_URL}"
elif DOCKER_COMPOSE == "true":
    DATABASE_URL = f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@db:5432/{POSTGRES_DB}"
else:
    DATABASE_URL = f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
