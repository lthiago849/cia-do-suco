"""Relatório diário de estoque enviado por e-mail aos funcionários às 8h."""
import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime
from html import escape
from zoneinfo import ZoneInfo

from sqlalchemy.dialects.postgresql import insert
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.const.config import NOME_LOJA, TIMEZONE_LOJA, HORA_RELATORIO_ESTOQUE, HORA_LIMITE_RELATORIO_ESTOQUE
from app.const.enums import CategoriaProduto
from app.db.db import async_session
from app.models.envio_relatorio import EnvioRelatorio
from app.models.produto import Produto
from app.models.usuario import Usuario
from app.utils.email import email_configurado, enviar_email
from app.validations.validar_horario import validar_horario

logger = logging.getLogger(__name__)

NOMES_CATEGORIA = {
    CategoriaProduto.SUCO: "SUCOS",
    CategoriaProduto.PICOLE: "PICOLÉS",
    CategoriaProduto.MORENINHA: "MORENINHAS",
    CategoriaProduto.CREMOSINHO: "CREMOSINHOS",
}
DIAS_SEMANA = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]


@dataclass
class RelatorioEstoque:
    assunto: str
    texto: str
    html: str


def agrupar_estoque(produtos: list[tuple[CategoriaProduto, str, int]]) -> list[tuple[str, int, list[tuple[str, int]]]]:
    """(título, total, [(sabor, quantidade)]) por categoria. Categorias sem produto cadastrado não aparecem."""
    grupos = []
    for categoria, titulo in NOMES_CATEGORIA.items():
        da_categoria = sorted((nome, qtd) for cat, nome, qtd in produtos if cat == categoria)
        if da_categoria:
            grupos.append((titulo, sum(qtd for _, qtd in da_categoria), da_categoria))
    return grupos


def texto_esgotados(produtos: list[tuple[CategoriaProduto, str, int]]) -> str | None:
    esgotados = sum(1 for _, _, qtd in produtos if qtd == 0)
    if not esgotados:
        return None
    return f"{esgotados} sabor{'es' if esgotados > 1 else ''} esgotado{'s' if esgotados > 1 else ''}"


def formatar_data(agora: datetime) -> str:
    return f"{DIAS_SEMANA[agora.weekday()]}, {agora:%d/%m/%Y às %H:%M}"


def formatar_mensagem_estoque(produtos: list[tuple[CategoriaProduto, str, int]], agora: datetime,
                              nome_loja: str = NOME_LOJA) -> str:
    """Texto simples (*negrito* no estilo do WhatsApp) com a quantidade de cada sabor, agrupado por categoria"""
    linhas = [f"*Estoque — {nome_loja}*", formatar_data(agora)]
    for titulo, total, itens in agrupar_estoque(produtos):
        linhas += ["", f"*{titulo}* ({total})"]
        linhas += [f"• {nome}: {qtd if qtd > 0 else 'esgotado'}" for nome, qtd in itens]
    if aviso := texto_esgotados(produtos):
        linhas += ["", f"⚠️ {aviso}"]
    return "\n".join(linhas)


def formatar_html_estoque(produtos: list[tuple[CategoriaProduto, str, int]], agora: datetime,
                          nome_loja: str = NOME_LOJA) -> str:
    """Mesmo conteúdo em HTML, com estilos inline (clientes de e-mail ignoram <style>)"""
    partes = [
        '<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2933;max-width:480px">',
        f'<h2 style="margin:0 0 2px;font-size:20px">Estoque — {escape(nome_loja)}</h2>',
        f'<div style="color:#6b7280;font-size:14px;margin-bottom:16px">{formatar_data(agora)}</div>',
    ]
    for titulo, total, itens in agrupar_estoque(produtos):
        partes.append(f'<h3 style="margin:16px 0 6px;font-size:15px">{titulo} ({total})</h3>'
                      '<table style="border-collapse:collapse;width:100%;font-size:15px">')
        for nome, qtd in itens:
            valor = (f'<strong>{qtd}</strong>' if qtd > 0
                     else '<span style="color:#c0392b;font-weight:bold">esgotado</span>')
            partes.append(f'<tr><td style="padding:5px 0;border-bottom:1px solid #eee">{escape(nome)}</td>'
                          f'<td style="padding:5px 0;border-bottom:1px solid #eee;text-align:right">{valor}</td></tr>')
        partes.append("</table>")
    if aviso := texto_esgotados(produtos):
        partes.append(f'<p style="margin-top:16px;color:#c0392b;font-weight:bold">⚠️ {aviso}</p>')
    partes.append("</div>")
    return "".join(partes)


async def montar_relatorio_estoque(db: AsyncSession) -> RelatorioEstoque:
    result = await db.exec(
        select(Produto.categoria, Produto.nome, Produto.quantidade_estoque).where(Produto.ativo == True)  # noqa: E712
    )
    produtos = list(result.all())
    agora = datetime.now(ZoneInfo(TIMEZONE_LOJA))
    return RelatorioEstoque(
        assunto=f"Estoque {NOME_LOJA} — {agora:%d/%m}",
        texto=formatar_mensagem_estoque(produtos, agora),
        html=formatar_html_estoque(produtos, agora),
    )


async def listar_destinatarios(db: AsyncSession) -> list[Usuario]:
    """Funcionários ativos marcados para receber o relatório"""
    result = await db.exec(
        select(Usuario)
        .where(Usuario.ativo == True, Usuario.recebe_relatorio == True)  # noqa: E712
        .order_by(Usuario.nome)
    )
    return list(result.all())


async def enviar_relatorio_estoque(db: AsyncSession) -> int:
    """Envia o relatório agora para quem está marcado. Retorna quantos receberam."""
    destinatarios = [u.email for u in await listar_destinatarios(db)]
    if not destinatarios:
        return 0
    relatorio = await montar_relatorio_estoque(db)
    await asyncio.to_thread(enviar_email, destinatarios, relatorio.assunto, relatorio.texto, relatorio.html)
    return len(destinatarios)


async def ultimo_envio_automatico(db: AsyncSession) -> EnvioRelatorio | None:
    result = await db.exec(select(EnvioRelatorio).order_by(col(EnvioRelatorio.data).desc()).limit(1))
    return result.first()


async def executar_envio_do_dia(db: AsyncSession, agora: datetime) -> None:
    """Faz o envio automático do dia, se ainda não foi feito. A linha do dia é reservada antes de enviar,
    então só um processo envia, mesmo com a API reiniciando ou rodando em paralelo."""
    reservado = await db.exec(
        insert(EnvioRelatorio).values(data=agora.date(), created_at=validar_horario())
        .on_conflict_do_nothing(index_elements=["data"]).returning(EnvioRelatorio.data)
    )
    if reservado.first() is None:
        await db.rollback()
        return
    await db.commit()

    envio = await db.get(EnvioRelatorio, agora.date())
    try:
        envio.destinatarios = await enviar_relatorio_estoque(db)
        if envio.destinatarios:
            envio.enviado_em = validar_horario()
            logger.info(f"Relatório de estoque enviado para {envio.destinatarios} funcionário(s).")
        else:
            envio.erro = "Nenhum funcionário marcado para receber o relatório."
            logger.warning(envio.erro)
    except Exception as e:
        envio.erro = f"Falha no envio do e-mail: {e}"
        logger.exception("Falha no envio do relatório de estoque")
    db.add(envio)
    await db.commit()


async def agendador_relatorio_estoque() -> None:
    """Roda em segundo plano enquanto a API está no ar e confere a cada minuto se é hora do relatório"""
    if not email_configurado():
        logger.warning("EMAIL_CONTA/EMAIL_SENHA não configurados: o relatório de estoque das 8h não será enviado.")
        return
    fuso = ZoneInfo(TIMEZONE_LOJA)
    while True:
        agora = datetime.now(fuso)
        if HORA_RELATORIO_ESTOQUE <= agora.hour < HORA_LIMITE_RELATORIO_ESTOQUE:
            try:
                async with async_session() as db:
                    await executar_envio_do_dia(db, agora)
            except Exception:
                logger.exception("Erro no agendador do relatório de estoque")
        await asyncio.sleep(60)
