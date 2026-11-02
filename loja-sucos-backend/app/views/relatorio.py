from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.const.enums import CategoriaProduto
from app.controllers.relatorio import (
    get_resumo, get_relatorio_produtos, get_vendas_por_dia, get_vendas_por_dia_semana, get_horarios_pico
)
from app.db.db import get_session
from app.exceptions.genericos import regra_de_negocio
from app.schemas.auth import UsuarioOut
from app.schemas.relatorio import (
    ResumoResponse, ProdutoRelatorio, VendaPorDia, VendaPorDiaSemana, HorarioPico, RelatorioEstoqueResponse,
    DestinatarioRelatorio, EnvioRelatorioResponse, EnvioManualResponse
)
from app.const.config import HORA_RELATORIO_ESTOQUE
from app.services.relatorio_estoque import (
    montar_relatorio_estoque, listar_destinatarios, enviar_relatorio_estoque, ultimo_envio_automatico
)
from app.utils.email import email_configurado
from app.security.auth import get_current_admin

# Datas no fuso da loja, inclusive. Sem datas = todo o histórico.
router = APIRouter(prefix="/relatorios", tags=["Relatórios"], dependencies=[Depends(get_current_admin)])


@router.get("/resumo", response_model=ResumoResponse)
async def get_resumo_endpoint(data_inicio: Optional[date] = None, data_fim: Optional[date] = None,
                              db: AsyncSession = Depends(get_session)):
    return await get_resumo(db, data_inicio, data_fim)


@router.get("/produtos", response_model=list[ProdutoRelatorio])
async def get_relatorio_produtos_endpoint(data_inicio: Optional[date] = None, data_fim: Optional[date] = None,
                                          categoria: Optional[CategoriaProduto] = None,
                                          db: AsyncSession = Depends(get_session)):
    """Mais vendidos e lucro por produto"""
    return await get_relatorio_produtos(db, data_inicio, data_fim, categoria)


@router.get("/por-dia", response_model=list[VendaPorDia])
async def get_vendas_por_dia_endpoint(data_inicio: Optional[date] = None, data_fim: Optional[date] = None,
                                      db: AsyncSession = Depends(get_session)):
    return await get_vendas_por_dia(db, data_inicio, data_fim)


@router.get("/por-dia-semana", response_model=list[VendaPorDiaSemana])
async def get_vendas_por_dia_semana_endpoint(data_inicio: Optional[date] = None, data_fim: Optional[date] = None,
                                             db: AsyncSession = Depends(get_session)):
    return await get_vendas_por_dia_semana(db, data_inicio, data_fim)


@router.get("/horarios-pico", response_model=list[HorarioPico])
async def get_horarios_pico_endpoint(data_inicio: Optional[date] = None, data_fim: Optional[date] = None,
                                     db: AsyncSession = Depends(get_session)):
    return await get_horarios_pico(db, data_inicio, data_fim)


@router.get("/estoque-diario", response_model=RelatorioEstoqueResponse)
async def get_estoque_diario_endpoint(db: AsyncSession = Depends(get_session)):
    """Prévia do relatório de estoque das 8h, quem vai recebê-lo e o último envio automático"""
    relatorio = await montar_relatorio_estoque(db)
    ultimo = await ultimo_envio_automatico(db)
    return RelatorioEstoqueResponse(
        assunto=relatorio.assunto,
        mensagem=relatorio.texto,
        html=relatorio.html,
        destinatarios=[DestinatarioRelatorio(nome=u.nome, email=u.email) for u in await listar_destinatarios(db)],
        email_configurado=email_configurado(),
        hora_envio=HORA_RELATORIO_ESTOQUE,
        ultimo_envio=EnvioRelatorioResponse.model_validate(ultimo, from_attributes=True) if ultimo else None,
    )


@router.post("/estoque-diario/enviar", response_model=EnvioManualResponse)
async def enviar_estoque_diario_endpoint(db: AsyncSession = Depends(get_session)):
    """Envia o relatório agora (não substitui o envio automático das 8h)"""
    if not email_configurado():
        regra_de_negocio("O e-mail de envio não está configurado (EMAIL_CONTA e EMAIL_SENHA no .env).")
    try:
        enviados = await enviar_relatorio_estoque(db)
    except Exception as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Não foi possível enviar o e-mail: {e}")
    if not enviados:
        regra_de_negocio("Nenhum funcionário marcado para receber o relatório.")
    return EnvioManualResponse(destinatarios=enviados)
