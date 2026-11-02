import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import tags
from .const.config import CORS_ORIGINS
from .logging_config import setup_logging
from .utils.lifespan import lifespan
from .views import router

setup_logging()

logger = logging.getLogger("main")
app = FastAPI(
    title="Loja de Sucos API",
    version="2.0.0",
    lifespan=lifespan,
    openapi_tags=tags,
)

app.include_router(router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
