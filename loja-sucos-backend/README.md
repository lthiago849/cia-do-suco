# Loja de Sucos — Backend (v2)

API em FastAPI + SQLModel (async) + PostgreSQL, com migrations em Flyway. Mesma arquitetura do SAIA:
`models → schemas → controllers → views`.

O sistema é **interno**: só funcionários acessam (perfis `ADMIN` e `ATENDENTE`).

## Pré-requisitos

- Docker e Docker Compose
- Poetry (opcional, só para rodar fora do Docker)

## Subindo

```bash
make env   # cria app/.env a partir do .env.example (troque SECRET_KEY e ADMIN_PASSWORD!)
make up    # sobe db, flyway, app e pgadmin
make logs
```

| Serviço  | Endereço                     |
|----------|------------------------------|
| API      | http://localhost:8000        |
| Swagger  | http://localhost:8000/docs   |
| Postgres | localhost:5436 (`LOJASUCOSDB`) |
| pgAdmin  | http://localhost:4042        |

No primeiro start é criado o usuário administrador definido em `ADMIN_LOGIN` / `ADMIN_PASSWORD`.

Testes: `make test` (roda o pytest dentro do container).

### Dados de demonstração

`make demo` popula um banco **recém-criado** com 60 dias de dados falsos (vendas, entregas, fiado, compras,
produção, descartes de garrafas e de produtos), com o catálogo de gelados e os preços de compra baseados na v1. Os funcionários de
demonstração e a senha deles estão em `app/scripts/popular_demo.py`. Para voltar ao banco vazio: `make reset-db`
(apaga tudo) e, se quiser, `make demo` de novo depois que a API subir.

### Acessando o banco

- **pgAdmin**: http://localhost:4042 (login em `docker_compose.yml`). Para conectar, cadastre um servidor com
  host `db`, porta `5432`, banco `LOJASUCOSDB` e usuário/senha do Postgres do `app/.env`.
- **DBeaver/outro cliente no seu computador**: host `localhost`, porta `5436`, mesmo banco/usuário/senha.
- **Terminal**: `docker exec -it loja-sucos-database psql -U postgres -d LOJASUCOSDB`

## Estrutura

```
app/
├── const/        enums, configuração e URL do banco
├── db/           engine e sessão assíncrona
├── models/       tabelas (SQLModel)
├── schemas/      entrada e saída da API (Pydantic)
├── controllers/  regras de negócio e consultas
├── views/        rotas (APIRouter)
├── security/     JWT e senhas (bcrypt)
├── utils/        custo médio, FIFO, filtros de período
├── validations/  senha, telefone, horário
└── migrations/   Flyway (versions/V<data>__descricao.sql)
```

Mudanças no banco entram sempre como **nova** migration em `app/migrations/versions` — nunca edite uma já aplicada.

## Regras importantes

- **Venda**: o total é calculado no servidor; estoque é travado (`SELECT ... FOR UPDATE`) e baixado na mesma transação.
  Cada item guarda preço e custo do momento, então o histórico e o lucro não mudam quando o preço muda.
- **Fiado**: venda `FIADO` exige cliente. Pagamentos quitam as compras da mais antiga para a mais nova.
- **Custo**: compras (entradas de estoque) e produção recalculam o custo médio ponderado.
  Produção desconta a fruta/polpa do produto, o açúcar e **uma garrafa PET por suco** (açúcar e garrafas do lote
  mais antigo primeiro). Sem garrafa em estoque, a produção é recusada.
- **Garrafas**: toda compra de garrafa registra se vieram **limpas ou sujas**. Garrafas sem condição de uso são
  registradas como **descarte** (quantidade, motivo, quem, quando e, opcionalmente, de qual compra). O valor pago
  pelas descartadas é repassado ao custo das que sobraram, e o valor perdido fica anotado no descarte.
- **Pedidos de entrega** (`/pedidos`): pedido do WhatsApp (bot) ou cadastrado pelo atendente segue
  `NOVO → ENTREGUE` (ou `CANCELADO`, com motivo). Na confirmação o atendente informa quem entregou, a taxa de
  entrega e a forma de pagamento, e só então o pedido vira venda
  (baixa o estoque, aplica taxa da maquininha e, se for o caso, lança no fiado). A forma de pagamento é opcional até
  lá; fiado só o atendente define. A taxa de entrega é do entregador (um funcionário): fica no pedido e fora do
  faturamento.
- **Endereço**: cada cliente tem um endereço ativo; ao cadastrar outro, o anterior vai para o histórico.
  Aceita só ponto de referência e/ou localização (latitude/longitude).
- **Cancelamento** (admin): devolve os produtos ao estoque; vendas canceladas saem dos relatórios.
- **Relatórios** (admin): datas agrupadas no fuso `America/Sao_Paulo`.
- **Custos são só do admin**: para atendentes, a API devolve vazios todos os campos de custo, taxa e perda
  (`security/permissoes.py`); relatórios, taxas e cadastro de funcionários respondem 403.
- **Relatório de estoque das 8h por e-mail**: vai para os funcionários ativos com `recebe_relatorio`, em cópia
  oculta, pela conta `EMAIL_CONTA`/`EMAIL_SENHA` do `.env` (Gmail com senha de app). O agendador roda dentro da
  API (`utils/lifespan.py`) e confere a cada minuto; se a API estiver fora do ar às 8h, envia quando voltar, até
  as 12h. A tabela `envio_relatorio` guarda um registro por dia, então o envio não se repete. Prévia, último envio
  e "Enviar agora" em `/relatorios/estoque-diario` (tela Funcionários).
- **Taxa da maquininha**: percentual por forma de pagamento (`/taxas-pagamento`). Com `repassar_cliente`, o cliente
  paga um acréscimo (`acrescimo_pagamento`) e o valor passado na máquina é `valor_total + acréscimo`; a taxa real
  (`taxa_pagamento`) é calculada sobre esse valor. Lucro = produtos + acréscimo − custo − taxa.

## Próxima etapa

Integração com o WhatsApp (bot de atendimento e avisos de pedido aos funcionários), aguardando a definição do
parceiro da Meta. O cliente já tem telefone normalizado (`5591988887777`) para ser identificado pelo número.

## Produção (servidor Oracle)

Roda em `https://ciadosuco.duckdns.org`, no mesmo servidor do Parcerias UFPA (backend em `~/loja-sucos/backend`,
projeto docker-compose `loja-sucos`).

**Deploy:** `CHAVE=/caminho/da/chave-ssh ./deploy.sh` — gera o frontend de produção, faz backup do banco
(`~/backups/loja-sucos/antes-deploy-*.dump`), copia o backend via tar (o servidor não tem rsync; o `app/.env` do
servidor nunca é sobrescrito), roda as migrações, reconstrói a API, publica o frontend e confere se tudo responde.

- `docker_compose.prod.yml`: banco sem porta publicada, API só em `127.0.0.1:8010`, sem pgAdmin.
  Subir/atualizar: `docker-compose --env-file app/.env -f docker_compose.prod.yml -p loja-sucos up -d --build`
- `app/.env` do servidor foi gerado lá, com senhas próprias (não é o mesmo do desenvolvimento).
- nginx (`/etc/nginx/sites-available/ciadosuco`): frontend estático em `/var/www/ciadosuco` e a API em `/api`
  (`BASEPATH=/api`). Certificado https pelo certbot.
- Frontend: `VITE_API_URL=https://ciadosuco.duckdns.org/api npx vite build` e copiar `dist/` para
  `/var/www/ciadosuco`.
- Banco pelo pgAdmin/psql local: túnel SSH, por exemplo
  `ssh -L 5437:<ip do container do banco>:5432 ubuntu@137.131.167.36`.
