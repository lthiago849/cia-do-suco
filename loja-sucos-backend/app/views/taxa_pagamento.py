from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.const.enums import FormaPagamento
from app.controllers.taxa_pagamento import listar_taxas, atualizar_taxa
from app.db.db import get_session
from app.schemas.auth import UsuarioOut
from app.schemas.taxa_pagamento import TaxaPagamentoUpdate, TaxaPagamentoResponse
from app.security.auth import get_current_user, get_current_admin

router = APIRouter(prefix="/taxas-pagamento", tags=["Taxas de pagamento"])


@router.get("/", response_model=list[TaxaPagamentoResponse])
async def listar_taxas_endpoint(db: AsyncSession = Depends(get_session), _: UsuarioOut = Depends(get_current_user)):
    return await listar_taxas(db)


@router.put("/{forma_pagamento}", response_model=TaxaPagamentoResponse)
async def atualizar_taxa_endpoint(forma_pagamento: FormaPagamento, taxa_update: TaxaPagamentoUpdate,
                                  db: AsyncSession = Depends(get_session),
                                  _: UsuarioOut = Depends(get_current_admin)):
    """Percentual cobrado pela maquininha. Vale para as vendas feitas a partir de agora."""
    return await atualizar_taxa(db, forma_pagamento, taxa_update)
