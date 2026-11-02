"""Popula um banco NOVO com dados FALSOS de demonstração: 60 dias de funcionamento da loja.

Tudo passa pela API (as mesmas regras do uso real: estoque, custo médio, taxa da maquininha, fiado,
pedidos de entrega). No final, as datas são ajustadas para ficarem espalhadas nos últimos 60 dias.
O catálogo de gelados e os preços de compra são baseados na v1 do projeto; clientes, telefones,
funcionários e vendas são inventados.

Uso (com a API no ar e o banco recém-criado):
    docker compose -f docker_compose.yml exec app poetry run python scripts/popular_demo.py

Senha dos funcionários de demonstração: SENHA_DEMO (abaixo).
"""
import asyncio
import json
import os
import random
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, time, timedelta
from urllib.error import HTTPError
from zoneinfo import ZoneInfo

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

import asyncpg  # noqa: E402

from app.const.url import DATABASE_URL  # noqa: E402

API = os.getenv("API_DEMO", "http://localhost:8000")
FUSO = ZoneInfo("America/Sao_Paulo")
DIAS = 60
SENHA_DEMO = "Demo@1234"

random.seed(2026)

FUNCIONARIOS = [
    # login, nome, e-mail, WhatsApp (fictícios: example.com é reservado e não entrega para ninguém)
    ("ana", "Ana Souza", "ana@example.com", "91900000001"),
    ("carlos", "Carlos Lima", "carlos@example.com", "91900000002"),
]

# Gelados da v1 (o cremosinho estava R$ 30,00 na v1, provável erro de digitação)
GELADOS = [
    # categoria, sabor, preço, custo de compra por unidade
    ("PICOLE", "Chocolate", 3.50, 1.60),
    ("PICOLE", "Milho Verde", 2.50, 1.10),
    ("PICOLE", "Morango", 2.50, 1.10),
    ("MORENINHA", "Chocolate", 3.00, 1.30),
    ("CREMOSINHO", "Chocolate Branco", 3.00, 1.20),
]

# Preço de compra por kg, com base nos valores da v1
PRECO_KG = {
    "Polpa de Goiaba": 10, "Polpa de Acerola": 12, "Polpa de Abacaxi": 5, "Polpa de Bacuri": 45,
    "Polpa de Caju": 8, "Polpa de Cupuaçu": 12, "Polpa de Graviola": 15, "Polpa de Murucí": 7,
    "Polpa de Maracujá": 13, "Laranja": 1.5, "Limão": 1.5, "Polpa de Taperebá": 13, "Polpa de Manga": 8,
}
# Receita de uma produção de 30 garrafas: (kg de fruta/polpa, kg de açúcar)
RECEITA = {"Laranja": (12, 0), "Laranja com Beterraba": (7, 0), "Limão": (2, 2), "Abacaxi": (6, 1.5)}
RECEITA_PADRAO = (3, 1.5)
# Popularidade dos sucos (peso no sorteio das vendas)
POPULARIDADE = {"Acerola": 9, "Maracujá": 8, "Cupuaçu": 8, "Goiaba": 6, "Taperebá": 6, "Laranja": 5, "Murucí": 5,
                "Caju": 4, "Graviola": 4, "Manga": 4, "Abacaxi": 4, "Limão": 3, "Laranja com Beterraba": 3, "Bacuri": 2}

BAIRROS = ["Guamá", "Pedreira", "Marco", "Jurunas", "Conjunto Maguari", "Sacramenta", "Telégrafo", "Cremação"]
CLIENTES = [
    # nome, pode comprar fiado, endereço (None = só ponto de referência)
    ("Dona Rita", True, None),
    ("Seu Raimundo", True, ("Tv. Mauriti", "1200")),
    ("Joana da Padaria", True, ("Rua dos Mundurucus", "455")),
    ("Tia Socorro", True, None),
    ("Seu Benedito", True, ("Alameda 8", "84")),
    ("Marcos Vinícius", False, ("Av. Pedro Miranda", "2010")),
    ("Paulo do Açaí", False, ("Passagem São Jorge", "37")),
    ("Fernanda Costa", False, ("Rua Diogo Móia", "880")),
    ("Luana Martins", False, ("Tv. Humaitá", "1502")),
    ("Dona Graça", False, None),
    ("Igor Santos", False, ("Rua Antônio Barreto", "130")),
    ("Neide Ferreira", False, ("Alameda 12", "41")),
    ("Pedro Henrique", False, ("Tv. Lomas Valentinas", "777")),
    ("Cláudia Ribeiro", False, ("Rua Curuçá", "560")),
    ("Seu Antônio", False, ("Passagem Mirandinha", "15")),
]
REFERENCIAS = ["casa da tia Maria, portão azul", "em frente à igreja", "do lado da mercearia do Zé",
               "casa amarela com grade branca", "perto da parada do ônibus", "vila no fim da passagem, casa 3"]
MOTIVOS_CANCELAMENTO = ["Cliente desistiu", "Não encontramos o endereço", "Cliente não atendeu", "Pediu errado"]

# Datas a corrigir no final: (tabela, id, {coluna: datetime})
ajustes: list[tuple[str, str, dict]] = []


# ===================== API =====================

def chamar(metodo, caminho, corpo=None, token=None, form=False):
    headers, dados = {}, None
    if corpo is not None:
        dados = (urllib.parse.urlencode(corpo) if form else json.dumps(corpo)).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded" if form else "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(API + caminho, data=dados, method=metodo, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read() or "null")
    except HTTPError as e:
        return e.code, json.loads(e.read() or "null")


def ok(metodo, caminho, corpo=None, token=None, form=False):
    status, dados = chamar(metodo, caminho, corpo, token, form)
    if status >= 300:
        raise RuntimeError(f"{metodo} {caminho} -> {status}: {dados}")
    return dados


def login(usuario, senha):
    return ok("POST", "/users/token", {"username": usuario, "password": senha}, form=True)["access_token"]


def momento(dia: date, hora: float) -> datetime:
    h = int(hora)
    m = int((hora - h) * 60)
    return datetime.combine(dia, time(h, m, random.randint(0, 59)), FUSO)


# ===================== Simulação =====================

def main():
    admin = login(os.getenv("ADMIN_LOGIN", "admin"), os.getenv("ADMIN_PASSWORD", "Admin@123"))
    if ok("GET", "/vendas/?incluir_canceladas=true&limit=1", token=admin):
        sys.exit("O banco já tem vendas. Recrie o banco antes (veja o README) para não misturar dados.")

    inicio = date.today() - timedelta(days=DIAS)
    agora = datetime.now(FUSO)

    # ---- Taxas da maquininha (cliente paga o acréscimo) ----
    ok("PUT", "/taxas-pagamento/CREDITO", {"percentual": 3.5, "repassar_cliente": True}, admin)
    ok("PUT", "/taxas-pagamento/DEBITO", {"percentual": 1.5, "repassar_cliente": True}, admin)

    # ---- Funcionários ----
    equipe = {}
    for login_, nome, email, fone in FUNCIONARIOS:
        u = ok("POST", "/users/", {"nome_usuario": login_, "nome": nome, "email": email, "senha": SENHA_DEMO,
                                   "tipo": "ATENDENTE", "telefone": fone,
                                   "recebe_relatorio": False}, admin)
        equipe[u["id"]] = login(login_, SENHA_DEMO)
        ajustes.append(("usuario", u["id"], {"created_at": momento(inicio, 8)}))
    id_admin = ok("GET", "/users/me", token=admin)["id"]
    atendentes = list(equipe)
    tokens = {**equipe, id_admin: admin}

    # ---- Gelados (comprados prontos) ----
    for categoria, sabor, preco, custo in GELADOS:
        ok("POST", "/produtos/", {"nome": sabor, "categoria": categoria, "preco_venda": preco,
                                  "custo_unitario": custo}, admin)

    # ---- Clientes ----
    clientes = []
    for i, (nome, fiado, endereco) in enumerate(CLIENTES):
        bairro = random.choice(BAIRROS)
        dados_endereco = {"ponto_referencia": random.choice(REFERENCIAS), "bairro": bairro}
        if endereco:
            dados_endereco.update(logradouro=endereco[0], numero=endereco[1])
        if random.random() < 0.5:
            dados_endereco.update(latitude=round(-1.45 + random.uniform(-0.03, 0.03), 6),
                                  longitude=round(-48.48 + random.uniform(-0.03, 0.03), 6))
        c = ok("POST", "/clientes/", {"nome": nome, "telefone": f"9190000{1000 + i}",
                                      "observacao": "Pode vender fiado" if fiado else None,
                                      "endereco": dados_endereco}, admin)
        clientes.append({"id": c["id"], "nome": nome, "fiado": fiado})
        cadastro = momento(inicio + timedelta(days=random.randint(0, 20)), 9)
        ajustes.append(("cliente", c["id"], {"created_at": cadastro}))
        ajustes.append(("endereco_cliente", c["endereco_atual"]["id"], {"created_at": cadastro, "confirmado_em": cadastro}))
    fiado_ok = [c for c in clientes if c["fiado"]]

    produtos = {(p["categoria"], p["nome"]): p for p in ok("GET", "/produtos/", token=admin)}
    sucos = [p for (cat, _), p in produtos.items() if cat == "SUCO"]
    gelados = [p for (cat, _), p in produtos.items() if cat != "SUCO"]
    pesos_sucos = [POPULARIDADE.get(p["nome"], 3) for p in sucos]
    ingredientes = {i["nome"]: i for i in ok("GET", "/ingredientes/", token=admin)}
    vendas_registradas = []

    for n_dia in range(DIAS + 1):
        dia = inicio + timedelta(days=n_dia)
        fim_de_semana = dia.weekday() >= 5
        estoque_ing = {i["nome"]: i["quantidade_estoque"] for i in ok("GET", "/ingredientes/", token=admin)}
        estoque = {p["id"]: p["quantidade_estoque"] for p in ok("GET", "/produtos/", token=admin)}

        def comprar(nome_ingrediente, quantidade, total, hora, **extra):
            e = ok("POST", "/entradas-estoque/", {"ingrediente_id": ingredientes[nome_ingrediente]["id"],
                                                 "quantidade": quantidade, "custo_total": round(total, 2), **extra},
                   tokens[random.choice(atendentes)])
            ajustes.append(("entrada_estoque", e["id"], {"created_at": momento(dia, hora)}))
            estoque_ing[nome_ingrediente] += quantidade
            return e

        def repor_garrafas():
            # Parte vem suja (mais barata) e algumas não têm salvação: vão para o descarte
            comprar("Garrafa PET", 400, 400 * 0.50, 7.0, condicao_garrafa="LIMPA")
            if random.random() < 0.5:
                sujas = comprar("Garrafa PET", 200, 200 * 0.20, 7.1, condicao_garrafa="SUJA",
                                observacao="Reciclagem do bairro")
                descartadas = random.randint(10, 35)
                d = ok("POST", "/descartes/", {"ingrediente_id": ingredientes["Garrafa PET"]["id"],
                                               "quantidade": descartadas, "entrada_estoque_id": sujas["id"],
                                               "motivo": "Sujas demais, nem lavando saiu"}, admin)
                ajustes.append(("descarte_estoque", d["id"], {"created_at": momento(dia, 9.5)}))
                estoque_ing["Garrafa PET"] -= descartadas

        if estoque_ing["Garrafa PET"] < 250:
            repor_garrafas()

        # Produção: repõe os sucos que estão acabando
        for suco in sucos:
            if estoque[suco["id"]] >= 12:
                continue
            polpa, acucar = RECEITA.get(suco["nome"], RECEITA_PADRAO)
            nome_polpa = suco["ingrediente_nome"]
            if estoque_ing["Garrafa PET"] < 30:
                repor_garrafas()
            if estoque_ing["Açúcar"] < acucar:
                comprar("Açúcar", 30, 30 * 3.5, 7.2)
            if estoque_ing[nome_polpa] < polpa:
                kg = max(polpa * 3, 10)
                comprar(nome_polpa, kg, kg * PRECO_KG[nome_polpa] * random.uniform(0.95, 1.1), 7.3)
            p = ok("POST", "/producoes/", {"produto_id": suco["id"], "quantidade_produzida": 30,
                                           "polpa_usada": polpa, "acucar_usado": acucar},
                   tokens[random.choice(atendentes)])
            ajustes.append(("producao", p["id"], {"produzido_em": momento(dia, random.uniform(7.5, 9))}))
            estoque[suco["id"]] += 30
            estoque_ing[nome_polpa] -= polpa
            estoque_ing["Açúcar"] -= acucar
            estoque_ing["Garrafa PET"] -= 30

        # Gelados: o fornecedor passa quando está acabando
        for g in gelados:
            if estoque[g["id"]] < 25:
                custo = next(c for cat, s, _, c in GELADOS if cat == g["categoria"] and s == g["nome"])
                e = ok("POST", "/entradas-estoque/", {"produto_id": g["id"], "quantidade": 80,
                                                     "custo_total": round(80 * custo, 2)}, admin)
                ajustes.append(("entrada_estoque", e["id"], {"created_at": momento(dia, 8)}))
                estoque[g["id"]] += 80

        def sortear_itens(max_itens):
            itens = {}
            for _ in range(random.choice([1, 1, 1, 2, 2, 3][:max_itens * 2])):
                if random.random() < 0.55:
                    p = random.choices(sucos, weights=pesos_sucos)[0]
                    qtd = random.choice([1, 1, 1, 2])
                else:
                    p = random.choice(gelados)
                    qtd = random.choice([1, 2, 2, 3, 4])
                if estoque[p["id"]] - itens.get(p["id"], 0) >= qtd:
                    itens[p["id"]] = itens.get(p["id"], 0) + qtd
            return itens

        # Vendas no balcão: mais movimento à tarde e no fim de semana
        horas = list(range(8, 21))
        peso_hora = [1, 2, 3, 5, 6, 5, 4, 6, 8, 9, 7, 4, 2]
        for _ in range(random.randint(24, 34) if fim_de_semana else random.randint(14, 22)):
            quando = momento(dia, random.choices(horas, weights=peso_hora)[0] + random.random())
            if quando > agora:
                continue
            itens = sortear_itens(3)
            if not itens:
                continue
            forma = random.choices(["DINHEIRO", "PIX", "DEBITO", "CREDITO", "FIADO"], weights=[34, 36, 14, 10, 6])[0]
            corpo = {"forma_pagamento": forma, "itens": [{"produto_id": k, "quantidade": v} for k, v in itens.items()]}
            if forma == "FIADO":
                corpo["cliente_id"] = random.choice(fiado_ok)["id"]
            vendedor = random.choices(atendentes + [id_admin], weights=[45, 45, 10])[0]
            status, v = chamar("POST", "/vendas/", corpo, tokens[vendedor])
            if status != 201:
                continue
            for k, q in itens.items():
                estoque[k] -= q
            vendas_registradas.append((v["id"], quando))

        # Pedidos de entrega
        for _ in range(random.randint(2, 5)):
            criado = momento(dia, random.choices(horas, weights=peso_hora)[0] + random.random())
            # A entrega leva até 80 min: pedidos de agora ficam só na fila de hoje (criada no fim)
            if criado > agora - timedelta(minutes=90):
                continue
            cliente = random.choice(clientes)
            itens = sortear_itens(2)
            if not itens:
                continue
            forma_whats = random.choice([None, None, "PIX", "DINHEIRO", "CREDITO"])
            ped = ok("POST", "/pedidos/", {"cliente_id": cliente["id"], "forma_pagamento": forma_whats,
                                           "itens": [{"produto_id": k, "quantidade": v} for k, v in itens.items()],
                                           "observacao": random.choice([None, None, "Troco para 50", "Sem açúcar"])},
                     tokens[random.choice(atendentes)])
            ajustes.append(("pedido", ped["id"], {"created_at": criado}))
            if random.random() < 0.08:
                cancelado = criado + timedelta(minutes=random.randint(10, 40))
                ok("POST", f"/pedidos/{ped['id']}/cancelar", {"motivo": random.choice(MOTIVOS_CANCELAMENTO)},
                   tokens[random.choice(atendentes)])
                ajustes[-1][2].update(cancelado_em=cancelado, updated_at=cancelado)
                continue
            entregue = criado + timedelta(minutes=random.randint(25, 80))
            forma = forma_whats or random.choice(["PIX", "DINHEIRO", "DEBITO"])
            if cliente["fiado"] and random.random() < 0.3:
                forma = "FIADO"
            status, ped = chamar("POST", f"/pedidos/{ped['id']}/entregar",
                                 {"entregador_id": random.choice(atendentes), "taxa_entrega": random.choice([5, 5, 7, 10]),
                                  "forma_pagamento": forma}, tokens[random.choice(atendentes)])
            if status != 200:
                continue
            for k, q in itens.items():
                estoque[k] -= q
            ajustes[-1][2].update(entregue_em=entregue, updated_at=entregue)
            vendas_registradas.append((ped["venda_id"], entregue))

        # De vez em quando um suco estraga ou um gelado derrete
        if random.random() < 0.15:
            item = random.choice(sucos + gelados)
            quando = momento(dia, random.uniform(17, 20))
            if estoque[item["id"]] >= 4 and quando <= agora:
                d = ok("POST", "/descartes/", {"produto_id": item["id"], "quantidade": random.randint(1, 3),
                                               "motivo": "Estragou" if item in sucos else "Derreteu"},
                       tokens[random.choice(atendentes)])
                ajustes.append(("descarte_estoque", d["id"], {"created_at": quando}))
                estoque[item["id"]] -= int(d["quantidade"])

        # Sábado à tarde: alguns clientes acertam o fiado
        if dia.weekday() == 5:
            for devedor in ok("GET", "/fiado/devedores", token=admin):
                quando = momento(dia, random.uniform(15, 18))
                if random.random() < 0.6 and quando <= agora:
                    valor = min(devedor["saldo"], random.choice([devedor["saldo"], 20, 30, 50]))
                    pg = ok("POST", "/fiado/pagamentos", {"cliente_id": devedor["cliente_id"], "valor": round(valor, 2),
                                                          "forma_pagamento": random.choice(["DINHEIRO", "PIX", "CREDITO"])},
                            tokens[random.choice(atendentes)])
                    ajustes.append(("pagamento_fiado", pg["id"], {"pago_em": quando}))

        # Uma cliente mudou de endereço no meio do período
        if n_dia == DIAS // 2:
            e = ok("POST", f"/clientes/{clientes[0]['id']}/enderecos",
                   {"logradouro": "Passagem Nova Esperança", "numero": "22", "bairro": "Guamá",
                    "ponto_referencia": "mudou para perto da feira, casa verde"}, admin)
            ajustes.append(("endereco_cliente", e["id"], {"created_at": momento(dia, 10), "confirmado_em": momento(dia, 10)}))

    # Duas vendas registradas errado e canceladas pelo admin
    for venda_id, quando in random.sample(vendas_registradas[:-50], 2):
        status, _ = chamar("POST", f"/vendas/{venda_id}/cancelar", token=admin)
        if status == 200:
            ajustes.append(("venda", venda_id, {"cancelada_em": quando + timedelta(minutes=5)}))

    # ---- Fila de hoje: pedidos aguardando entrega, dois "vindos do WhatsApp" ----
    novo_whats = ok("POST", "/clientes/", {"nome": "Bia 🌻", "telefone": "91900009999",
                                           "observacao": "Cliente novo pelo WhatsApp"}, admin)
    fila = [
        (clientes[1], [("SUCO", "Cupuaçu", 2), ("SUCO", "Acerola", 1)], None, "Troco para 50", True),
        (clientes[6], [("SUCO", "Bacuri", 1), ("PICOLE", "Chocolate", 3)], "PIX", None, True),
        ({"id": novo_whats["id"]}, [("SUCO", "Maracujá", 2)], None, "Primeira vez que pede", True),
        (clientes[3], [("SUCO", "Goiaba", 2), ("MORENINHA", "Chocolate", 2)], None, None, False),
    ]
    for i, (cliente, itens, forma, obs, whatsapp) in enumerate(fila):
        ped = ok("POST", "/pedidos/", {"cliente_id": cliente["id"], "forma_pagamento": forma, "observacao": obs,
                                       "itens": [{"produto_id": produtos[(cat, nome)]["id"], "quantidade": q}
                                                 for cat, nome, q in itens]}, tokens[atendentes[0]])
        criado = agora - timedelta(minutes=8 + 11 * i)
        ajustes.append(("pedido", ped["id"], {"created_at": criado, "updated_at": criado}))
        if whatsapp:
            ajustes.append(("pedido_whatsapp", ped["id"], {}))

    # ---- Datas: espalha tudo nos últimos 60 dias ----
    for venda_id, quando in vendas_registradas:
        ajustes.append(("venda", venda_id, {"data_venda": quando, "created_at": quando, "updated_at": quando}))
    asyncio.run(aplicar_datas())

    resumo = ok("GET", f"/relatorios/resumo?data_inicio={inicio}&data_fim={date.today()}", token=admin)
    print(f"Pronto: {resumo['num_vendas']} vendas, faturamento R$ {resumo['faturamento']:.2f}, "
          f"lucro R$ {resumo['lucro']:.2f}, fiado a receber R$ {resumo['fiado_em_aberto_total']:.2f}")


async def aplicar_datas():
    conexao = await asyncpg.connect(DATABASE_URL.replace("postgresql+asyncpg", "postgresql"))
    try:
        async with conexao.transaction():
            for tabela, id_, colunas in ajustes:
                if tabela == "pedido_whatsapp":
                    await conexao.execute("UPDATE pedido SET origem = 'WHATSAPP', criado_por = NULL WHERE id = $1",
                                          _uuid(id_))
                    continue
                if not colunas:
                    continue
                sets = ", ".join(f"{coluna} = ${n + 2}" for n, coluna in enumerate(colunas))
                await conexao.execute(f"UPDATE {tabela} SET {sets} WHERE id = $1", _uuid(id_), *colunas.values())
    finally:
        await conexao.close()


def _uuid(texto):
    import uuid
    return uuid.UUID(texto)


if __name__ == "__main__":
    main()
