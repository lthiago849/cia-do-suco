from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from datetime import datetime

from app.const.enums import CategoriaProduto, FormaPagamento
from app.schemas.cliente import EnderecoCreate, ClienteCreate
from app.schemas.descarte_estoque import DescarteCreate
from app.schemas.entrada_estoque import EntradaEstoqueCreate
from app.schemas.fiado import PagamentoFiadoCreate
from app.schemas.usuario import UsuarioCreate
from app.schemas.venda import VendaCreate
from app.services.relatorio_estoque import formatar_mensagem_estoque, formatar_html_estoque
from app.utils.estoque import calcular_cobranca, calcular_custo_apos_descarte, calcular_custo_medio, distribuir_fifo
from app.validations.telefone import normalizar_telefone


# ========== custo médio ==========

def test_custo_medio_pondera_estoque_atual_e_entrada():
    # 10 un a R$ 2,00 + 10 un compradas por R$ 30,00 (R$ 3,00 cada) = média R$ 2,50
    assert calcular_custo_medio(Decimal(10), Decimal("2"), Decimal(10), Decimal("30")) == Decimal("2.5000")


def test_custo_medio_com_estoque_zerado_usa_custo_da_entrada():
    assert calcular_custo_medio(Decimal(0), Decimal("9"), Decimal(4), Decimal("10")) == Decimal("2.5000")


def test_descarte_repassa_custo_para_o_que_sobrou():
    # 100 garrafas a R$ 0,50 (R$ 50 pagos), 20 descartadas -> 80 garrafas a R$ 0,625
    assert calcular_custo_apos_descarte(Decimal(100), Decimal("0.5"), Decimal(20)) == Decimal("0.6250")


def test_descarte_de_tudo_mantem_custo():
    assert calcular_custo_apos_descarte(Decimal(10), Decimal("0.5"), Decimal(10)) == Decimal("0.5")


# ========== FIFO (açúcar da produção e pagamento do fiado) ==========

def test_fifo_abate_do_mais_antigo_primeiro():
    assert distribuir_fifo(Decimal("7"), [Decimal("5"), Decimal("4"), Decimal("3")]) == [
        Decimal("5"), Decimal("2"), Decimal("0")]


def test_fifo_valor_exato():
    assert distribuir_fifo(Decimal("9"), [Decimal("5"), Decimal("4")]) == [Decimal("5"), Decimal("4")]


# ========== telefone ==========

@pytest.mark.parametrize("entrada, esperado", [
    ("(91) 98888-7777", "5591988887777"),
    ("91 3222-1111", "559132221111"),
    ("+55 91 98888-7777", "5591988887777"),
    ("", None),
    (None, None),
])
def test_normalizar_telefone(entrada, esperado):
    assert normalizar_telefone(entrada) == esperado


def test_telefone_invalido():
    with pytest.raises(ValueError):
        normalizar_telefone("12345")


def test_cliente_normaliza_telefone():
    assert ClienteCreate(nome="Dona Rita", telefone="(91) 98888-7777").telefone == "5591988887777"


# ========== validações de schema ==========

def test_venda_fiado_exige_cliente():
    with pytest.raises(ValidationError):
        VendaCreate(itens=[{"produto_id": uuid4(), "quantidade": 1}], forma_pagamento=FormaPagamento.FIADO)


def test_venda_sem_itens_invalida():
    with pytest.raises(ValidationError):
        VendaCreate(itens=[], forma_pagamento=FormaPagamento.PIX)


def test_pagamento_fiado_nao_aceita_fiado():
    with pytest.raises(ValidationError):
        PagamentoFiadoCreate(cliente_id=uuid4(), valor=Decimal(10), forma_pagamento=FormaPagamento.FIADO)


def test_endereco_aceita_so_ponto_de_referencia():
    endereco = EnderecoCreate(ponto_referencia="Casa da tia Maria, portão azul")
    assert endereco.logradouro is None


def test_endereco_vazio_invalido():
    with pytest.raises(ValidationError):
        EnderecoCreate(numero="10")


def test_entrada_exige_exatamente_um_alvo():
    with pytest.raises(ValidationError):
        EntradaEstoqueCreate(quantidade=Decimal(1), custo_total=Decimal(1))
    with pytest.raises(ValidationError):
        EntradaEstoqueCreate(produto_id=uuid4(), ingrediente_id=uuid4(), quantidade=Decimal(1), custo_total=Decimal(1))


def test_entrada_de_produto_exige_quantidade_inteira():
    with pytest.raises(ValidationError):
        EntradaEstoqueCreate(produto_id=uuid4(), quantidade=Decimal("1.5"), custo_total=Decimal(1))


# ========== relatório de estoque (e-mail das 8h) ==========

def test_mensagem_estoque_agrupa_por_categoria_e_marca_esgotados():
    produtos = [
        (CategoriaProduto.SUCO, "Goiaba", 12),
        (CategoriaProduto.SUCO, "Acerola", 0),
        (CategoriaProduto.PICOLE, "Coco", 30),
    ]
    mensagem = formatar_mensagem_estoque(produtos, datetime(2026, 10, 30, 8, 0), "Cia do Suco")
    assert mensagem.splitlines()[:2] == ["*Estoque — Cia do Suco*", "sexta, 30/10/2026 às 08:00"]
    assert "*SUCOS* (12)\n• Acerola: esgotado\n• Goiaba: 12" in mensagem
    assert "*PICOLÉS* (30)\n• Coco: 30" in mensagem
    # Categoria sem produto não aparece
    assert "MORENINHAS" not in mensagem
    assert mensagem.endswith("⚠️ 1 sabor esgotado")


def test_html_estoque_escapa_nomes_e_marca_esgotados():
    produtos = [(CategoriaProduto.SUCO, "Goiaba <b>", 12), (CategoriaProduto.SUCO, "Acerola", 0)]
    html = formatar_html_estoque(produtos, datetime(2026, 10, 30, 8, 0), "Cia do Suco")
    assert "Goiaba &lt;b&gt;" in html and "<b>" not in html
    assert "esgotado</span>" in html
    assert "1 sabor esgotado" in html


def test_usuario_normaliza_telefone():
    usuario = UsuarioCreate(nome_usuario="maria", nome="Maria", email="maria@loja.com", senha="Maria@123",
                            telefone="(91) 98983-7380")
    assert usuario.telefone == "5591989837380"


# ========== taxa da maquininha ==========

def test_cliente_paga_a_taxa():
    # R$ 25,00 a 3,5%: passa R$ 25,88 na máquina, que cobra 3,5% de R$ 25,88 = R$ 0,91
    assert calcular_cobranca(Decimal(25), Decimal("3.5"), True) == (Decimal("0.88"), Decimal("0.91"))


def test_loja_absorve_a_taxa():
    assert calcular_cobranca(Decimal(25), Decimal("3.5"), False) == (Decimal(0), Decimal("0.88"))


def test_descarte_exige_exatamente_um_alvo_e_produto_inteiro():
    with pytest.raises(ValidationError):
        DescarteCreate(quantidade=Decimal(1), motivo="Estragou")
    with pytest.raises(ValidationError):
        DescarteCreate(produto_id=uuid4(), ingrediente_id=uuid4(), quantidade=Decimal(1), motivo="Estragou")
    with pytest.raises(ValidationError):
        DescarteCreate(produto_id=uuid4(), quantidade=Decimal("1.5"), motivo="Estragou")
    assert DescarteCreate(produto_id=uuid4(), quantidade=Decimal(2), motivo="Estragou").ingrediente_id is None
