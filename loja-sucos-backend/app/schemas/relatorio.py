from uuid import UUID
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.const.enums import CategoriaProduto, FormaPagamento
from app.schemas.comum import DecimalJson


class FormaPagamentoResumo(BaseModel):
    forma_pagamento: FormaPagamento
    total: DecimalJson
    quantidade: int
    percentual: float
    taxas: DecimalJson


class ResumoResponse(BaseModel):
    faturamento: DecimalJson
    custo: DecimalJson
    # Taxas da maquininha: das vendas do período e dos pagamentos de fiado no cartão feitos no período
    taxas: DecimalJson
    # Acréscimo do cartão pago pelos clientes (cobre a taxa quando ela é repassada)
    acrescimos: DecimalJson
    # faturamento + acréscimos - custo - taxas
    lucro: DecimalJson
    num_vendas: int
    ticket_medio: DecimalJson
    # Vendido fiado no período e o que ainda falta receber de todos os clientes (independe do período)
    fiado_vendido_periodo: DecimalJson
    fiado_em_aberto_total: DecimalJson
    por_forma_pagamento: list[FormaPagamentoResumo]


class ProdutoRelatorio(BaseModel):
    produto_id: UUID
    nome: str
    categoria: CategoriaProduto
    quantidade: int
    receita: DecimalJson
    custo: DecimalJson
    # Taxa da maquininha menos o acréscimo pago pelo cliente, dividida entre os itens da venda
    # proporcionalmente ao valor de cada um (zero quando a taxa é toda repassada)
    taxas: DecimalJson
    lucro: DecimalJson
    margem: float


class VendaPorDia(BaseModel):
    dia: date
    faturamento: DecimalJson
    lucro: DecimalJson
    num_vendas: int


class VendaPorDiaSemana(BaseModel):
    # 1 = segunda ... 7 = domingo (ISO)
    dia_semana: int
    nome: str
    faturamento: DecimalJson
    num_vendas: int
    dias_com_venda: int
    media_faturamento: DecimalJson


class HorarioPico(BaseModel):
    dia_semana: int
    hora: int
    num_vendas: int
    faturamento: DecimalJson


class DestinatarioRelatorio(BaseModel):
    nome: str
    email: str


class EnvioRelatorioResponse(BaseModel):
    data: date
    enviado_em: Optional[datetime] = None
    destinatarios: int
    erro: Optional[str] = None


class RelatorioEstoqueResponse(BaseModel):
    """Prévia do relatório diário de estoque, quem vai recebê-lo e como foi o último envio automático"""
    assunto: str
    mensagem: str
    html: str
    destinatarios: list[DestinatarioRelatorio]
    email_configurado: bool
    hora_envio: int
    ultimo_envio: Optional[EnvioRelatorioResponse] = None


class EnvioManualResponse(BaseModel):
    destinatarios: int
