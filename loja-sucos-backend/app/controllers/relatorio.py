from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, extract, distinct
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.const.enums import CategoriaProduto, FormaPagamento
from app.models.item_venda import ItemVenda
from app.models.pagamento_fiado import PagamentoFiado
from app.models.produto import Produto
from app.models.venda import Venda
from app.schemas.relatorio import (
    ResumoResponse, FormaPagamentoResumo, ProdutoRelatorio, VendaPorDia, VendaPorDiaSemana, HorarioPico
)
from app.utils.estoque import arredondar_dinheiro
from app.utils.fiado import condicao_fiado_aberto, saldo_venda
from app.utils.periodo import filtrar_periodo, data_local, horario_local

NOMES_DIAS_SEMANA = {1: "Segunda", 2: "Terça", 3: "Quarta", 4: "Quinta", 5: "Sexta", 6: "Sábado", 7: "Domingo"}

ZERO = Decimal(0)


def vendas_validas(query, data_inicio: Optional[date], data_fim: Optional[date]):
    """Vendas não canceladas no período"""
    query = query.where(col(Venda.cancelada_em).is_(None))
    return filtrar_periodo(query, Venda.data_venda, data_inicio, data_fim)


async def get_resumo(db: AsyncSession, data_inicio: Optional[date], data_fim: Optional[date]) -> ResumoResponse:
    result = await db.exec(vendas_validas(
        select(Venda.forma_pagamento, func.sum(Venda.valor_total), func.sum(Venda.custo_total),
               func.sum(Venda.taxa_pagamento), func.count(Venda.id), func.sum(Venda.acrescimo_pagamento))
        .group_by(Venda.forma_pagamento),
        data_inicio, data_fim,
    ))
    linhas = result.all()

    faturamento = sum((total for _, total, _, _, _, _ in linhas), ZERO)
    custo = sum((custo_forma for _, _, custo_forma, _, _, _ in linhas), ZERO)
    num_vendas = sum(quantidade for _, _, _, _, quantidade, _ in linhas)

    result = await db.exec(filtrar_periodo(
        select(func.coalesce(func.sum(PagamentoFiado.taxa_pagamento), 0),
               func.coalesce(func.sum(PagamentoFiado.acrescimo_pagamento), 0)),
        PagamentoFiado.pago_em, data_inicio, data_fim,
    ))
    taxas_fiado, acrescimos_fiado = result.one()
    taxas = sum((taxa for _, _, _, taxa, _, _ in linhas), ZERO) + taxas_fiado
    acrescimos = sum((acrescimo for _, _, _, _, _, acrescimo in linhas), ZERO) + acrescimos_fiado

    por_forma = sorted(
        (
            FormaPagamentoResumo(
                forma_pagamento=forma,
                total=total,
                quantidade=quantidade,
                percentual=round(float(total / faturamento * 100), 1) if faturamento else 0.0,
                taxas=taxa,
            )
            for forma, total, _, taxa, quantidade, _ in linhas
        ),
        key=lambda f: f.total,
        reverse=True,
    )
    fiado_vendido = next((f.total for f in por_forma if f.forma_pagamento == FormaPagamento.FIADO), ZERO)

    result = await db.exec(select(func.coalesce(func.sum(saldo_venda()), 0))
                           .where(condicao_fiado_aberto()))
    fiado_em_aberto = result.one()

    return ResumoResponse(
        faturamento=faturamento,
        custo=custo,
        taxas=taxas,
        acrescimos=acrescimos,
        lucro=faturamento + acrescimos - custo - taxas,
        num_vendas=num_vendas,
        ticket_medio=arredondar_dinheiro(faturamento / num_vendas) if num_vendas else ZERO,
        fiado_vendido_periodo=fiado_vendido,
        fiado_em_aberto_total=fiado_em_aberto,
        por_forma_pagamento=por_forma,
    )


async def get_relatorio_produtos(db: AsyncSession, data_inicio: Optional[date], data_fim: Optional[date],
                                 categoria: Optional[CategoriaProduto] = None) -> list[ProdutoRelatorio]:
    """Quantidade vendida, receita, custo e lucro de cada produto (mais vendido primeiro)"""
    quantidade = func.sum(ItemVenda.quantidade)
    query = (
        select(Produto.id, Produto.nome, Produto.categoria, quantidade,
               func.sum(ItemVenda.quantidade * ItemVenda.preco_unitario),
               func.sum(ItemVenda.quantidade * ItemVenda.custo_unitario),
               func.sum(ItemVenda.quantidade * ItemVenda.preco_unitario
                        * (Venda.taxa_pagamento - Venda.acrescimo_pagamento)
                        / func.nullif(Venda.valor_total + Venda.taxa_entrega, 0)))
        .join(ItemVenda, ItemVenda.produto_id == Produto.id)
        .join(Venda, ItemVenda.venda_id == Venda.id)
        .group_by(Produto.id)
        .order_by(quantidade.desc(), Produto.nome)
    )
    if categoria is not None:
        query = query.where(Produto.categoria == categoria)

    result = await db.exec(vendas_validas(query, data_inicio, data_fim))

    relatorio = []
    for produto_id, nome, categoria_produto, qtd, receita, custo, taxas in result.all():
        custo = arredondar_dinheiro(custo)
        taxas = arredondar_dinheiro(taxas or ZERO)
        lucro = receita - custo - taxas
        relatorio.append(ProdutoRelatorio(
            produto_id=produto_id,
            nome=nome,
            categoria=categoria_produto,
            quantidade=qtd,
            receita=receita,
            custo=custo,
            taxas=taxas,
            lucro=lucro,
            margem=round(float(lucro / receita * 100), 1) if receita else 0.0,
        ))
    return relatorio


async def get_vendas_por_dia(db: AsyncSession, data_inicio: Optional[date],
                             data_fim: Optional[date]) -> list[VendaPorDia]:
    dia = data_local(Venda.data_venda)
    result = await db.exec(vendas_validas(
        select(dia, func.sum(Venda.valor_total),
               func.sum(Venda.valor_total + Venda.acrescimo_pagamento - Venda.custo_total - Venda.taxa_pagamento),
               func.count(Venda.id))
        .group_by(dia),
        data_inicio, data_fim,
    ))
    por_dia = {d: [faturamento, lucro, num_vendas] for d, faturamento, lucro, num_vendas in result.all()}

    # Taxa (menos o acréscimo pago pelo cliente) dos pagamentos de fiado no cartão entra no dia em que foi paga
    dia_pagamento = data_local(PagamentoFiado.pago_em)
    result = await db.exec(filtrar_periodo(
        select(dia_pagamento, func.sum(PagamentoFiado.acrescimo_pagamento - PagamentoFiado.taxa_pagamento))
        .where(PagamentoFiado.taxa_pagamento > 0)
        .group_by(dia_pagamento),
        PagamentoFiado.pago_em, data_inicio, data_fim,
    ))
    for d, saldo_taxa in result.all():
        por_dia.setdefault(d, [ZERO, ZERO, 0])[1] += saldo_taxa

    return [
        VendaPorDia(dia=d, faturamento=faturamento, lucro=lucro, num_vendas=num_vendas)
        for d, (faturamento, lucro, num_vendas) in sorted(por_dia.items())
    ]


async def get_vendas_por_dia_semana(db: AsyncSession, data_inicio: Optional[date],
                                    data_fim: Optional[date]) -> list[VendaPorDiaSemana]:
    """Total e média de faturamento por dia da semana. Sempre devolve os 7 dias."""
    dia_semana = extract("isodow", horario_local(Venda.data_venda))
    result = await db.exec(vendas_validas(
        select(dia_semana, func.sum(Venda.valor_total), func.count(Venda.id),
               func.count(distinct(data_local(Venda.data_venda))))
        .group_by(dia_semana),
        data_inicio, data_fim,
    ))
    por_dia = {int(dia): (faturamento, num_vendas, dias) for dia, faturamento, num_vendas, dias in result.all()}

    relatorio = []
    for dia, nome in NOMES_DIAS_SEMANA.items():
        faturamento, num_vendas, dias = por_dia.get(dia, (ZERO, 0, 0))
        relatorio.append(VendaPorDiaSemana(
            dia_semana=dia,
            nome=nome,
            faturamento=faturamento,
            num_vendas=num_vendas,
            dias_com_venda=dias,
            media_faturamento=arredondar_dinheiro(faturamento / dias) if dias else ZERO,
        ))
    return relatorio


async def get_horarios_pico(db: AsyncSession, data_inicio: Optional[date],
                            data_fim: Optional[date]) -> list[HorarioPico]:
    """Vendas por dia da semana x hora (mapa de calor). Só devolve as combinações com venda."""
    dia_semana = extract("isodow", horario_local(Venda.data_venda))
    hora = extract("hour", horario_local(Venda.data_venda))
    result = await db.exec(vendas_validas(
        select(dia_semana, hora, func.count(Venda.id), func.sum(Venda.valor_total))
        .group_by(dia_semana, hora)
        .order_by(dia_semana, hora),
        data_inicio, data_fim,
    ))
    return [
        HorarioPico(dia_semana=int(dia), hora=int(h), num_vendas=num_vendas, faturamento=faturamento)
        for dia, h, num_vendas, faturamento in result.all()
    ]
