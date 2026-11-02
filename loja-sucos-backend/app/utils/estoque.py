from decimal import Decimal, ROUND_HALF_UP

CENTAVOS = Decimal("0.01")
QUATRO_CASAS = Decimal("0.0001")


def arredondar_dinheiro(valor: Decimal) -> Decimal:
    return valor.quantize(CENTAVOS, rounding=ROUND_HALF_UP)


def calcular_custo_medio(quantidade_atual: Decimal, custo_atual: Decimal,
                         quantidade_entrada: Decimal, custo_total_entrada: Decimal) -> Decimal:
    """Custo unitário médio ponderado depois de uma entrada (compra ou produção)"""
    quantidade_atual = Decimal(quantidade_atual)
    quantidade_entrada = Decimal(quantidade_entrada)
    quantidade_final = quantidade_atual + quantidade_entrada
    if quantidade_final <= 0:
        return Decimal(custo_atual)

    valor_estoque = quantidade_atual * Decimal(custo_atual) + Decimal(custo_total_entrada)
    return (valor_estoque / quantidade_final).quantize(QUATRO_CASAS, rounding=ROUND_HALF_UP)


def calcular_custo_apos_descarte(quantidade_atual: Decimal, custo_atual: Decimal,
                                 quantidade_descartada: Decimal) -> Decimal:
    """O valor pago pelo estoque continua o mesmo, mas agora dividido por menos unidades.
    Ex.: 100 garrafas a R$ 0,50 (R$ 50) com 20 descartadas -> 80 garrafas a R$ 0,625."""
    restante = Decimal(quantidade_atual) - Decimal(quantidade_descartada)
    if restante <= 0:
        return Decimal(custo_atual)
    return (Decimal(quantidade_atual) * Decimal(custo_atual) / restante).quantize(QUATRO_CASAS, rounding=ROUND_HALF_UP)


def calcular_cobranca(valor: Decimal, percentual: Decimal, repassar_cliente: bool) -> tuple[Decimal, Decimal]:
    """(acréscimo pago pelo cliente, taxa da maquininha).
    Repassando, o cliente paga valor + percentual (ex.: R$ 25,00 + 3,5% = R$ 25,88 na máquina) e a maquininha
    cobra o percentual sobre o que foi passado nela (R$ 0,91)."""
    acrescimo = arredondar_dinheiro(Decimal(valor) * Decimal(percentual) / 100) if repassar_cliente else Decimal(0)
    taxa = arredondar_dinheiro((Decimal(valor) + acrescimo) * Decimal(percentual) / 100)
    return acrescimo, taxa


def distribuir_fifo(valor: Decimal, saldos: list[Decimal]) -> list[Decimal]:
    """Distribui <valor> entre os <saldos> na ordem recebida (mais antigo primeiro).
    Retorna quanto foi abatido de cada saldo. Usado no açúcar da produção e no pagamento do fiado."""
    restante = Decimal(valor)
    abatimentos = []
    for saldo in saldos:
        abatido = min(Decimal(saldo), restante) if restante > 0 else Decimal(0)
        abatimentos.append(abatido)
        restante -= abatido
    return abatimentos
