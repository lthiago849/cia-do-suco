# Loja de Sucos — Frontend (v2)

React 18 + TypeScript + Vite, com react-router-dom, sonner, Phosphor Icons e Highcharts
(mesmas bibliotecas do saia-frontend). Estilos em CSS Modules.

## Rodando

```bash
cp .env.example .env   # VITE_API_URL aponta para a API (padrão http://localhost:8000)
npm install
npm run dev            # http://localhost:5173
```

O backend precisa estar no ar (veja `loja-sucos-backend`). Build de produção: `npm run build` ou o `Dockerfile` (nginx).

## Telas

| Rota | Quem | O quê |
|------|------|-------|
| `/pdv` | todos | Caixa: escolher produtos, forma de pagamento (fiado pede cliente) |
| `/entregas` | todos | Fila de pedidos (revisar, saiu para entrega, confirmar entrega, cancelar) e histórico por entregador |
| `/vendas` | todos | Histórico de vendas por período; admin vê lucro e cancela |
| `/clientes`, `/clientes/:id` | todos | Cadastro, endereço atual + histórico, confirmar/trocar endereço, fiado do cliente |
| `/fiado` | todos | Quem está devendo, há quanto tempo |
| `/estoque` | todos | Estoque de produtos e ingredientes, registrar compra |
| `/producao` | todos | Registrar produção de sucos (baixa polpa e açúcar) |
| `/admin/dashboard` | admin | Faturamento, lucro, mais vendidos, dia e horário de pico, formas de pagamento |
| `/admin/produtos`, `/admin/ingredientes`, `/admin/usuarios` | admin | Cadastros |

## Estrutura

```
src/LojaComponents/
├── GlobalContext.tsx        token (cookie) e usuário logado
├── Auth.tsx                 valida o token em /users/me; AdminOnly
├── DefaultLayout.tsx        menu lateral
├── Hooks/FetchData/         useFetchData: todas as chamadas à API
├── Interfaces.ts            tipos espelhando os schemas do backend
├── Utils/                   formatação (moeda, data, telefone) e endereço
├── PagesSections/           Modal, SeletorPeriodo, BuscaCliente, FormEndereco
└── Pages/                   uma pasta por tela
```
