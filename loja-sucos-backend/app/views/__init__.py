from fastapi import APIRouter

from app.views.usuario import router as usuario
from app.views.produto import router as produto
from app.views.ingrediente import router as ingrediente
from app.views.estoque import router as estoque
from app.views.venda import router as venda
from app.views.cliente import router as cliente
from app.views.fiado import router as fiado
from app.views.relatorio import router as relatorio
from app.views.taxa_pagamento import router as taxa_pagamento
from app.views.pedido import router as pedido

router = APIRouter()

router.include_router(usuario)
router.include_router(produto)
router.include_router(ingrediente)
router.include_router(estoque)
router.include_router(venda)
router.include_router(cliente)
router.include_router(fiado)
router.include_router(relatorio)
router.include_router(taxa_pagamento)
router.include_router(pedido)
