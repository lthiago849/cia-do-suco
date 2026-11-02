/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { useGlobalContext } from "../../GlobalContext";
import {
  Cliente,
  CondicaoGarrafa,
  Descarte,
  Devedor,
  Endereco,
  EnderecoForm,
  EntradaEstoque,
  EntregadorResumo,
  ExtratoFiado,
  FormaPagamento,
  HorarioPico,
  Ingrediente,
  MembroEquipe,
  PagamentoFiado,
  Pedido,
  RelatorioEstoque,
  Periodo,
  Producao,
  Produto,
  ProdutoRelatorio,
  ResumoRelatorio,
  TaxaPagamento,
  Usuario,
  Venda,
  VendaPorDia,
  VendaPorDiaSemana,
} from "../../Interfaces";

const baseURL = import.meta.env.VITE_API_URL;

export interface RespostaApi<T> {
  status: number;
  ok: boolean;
  data: T;
}

/** Transforma o "detail" do FastAPI (texto ou lista de erros de validação) em uma mensagem legível */
export function mensagemErro(data: any): string {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail.map((erro: any) => String(erro.msg).replace(/^Value error, /, "")).join(" ");
  }
  return "Não foi possível completar a operação.";
}

function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const busca = new URLSearchParams();
  Object.entries(params).forEach(([chave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== "") busca.append(chave, String(valor));
  });
  const texto = busca.toString();
  return texto ? `?${texto}` : "";
}

export function useFetchData() {
  const { account } = useGlobalContext();
  const navigate = useNavigate();
  const { loginToken, logout } = account;

  const request = useCallback(
    async <T,>(method: string, path: string, body?: unknown): Promise<RespostaApi<T>> => {
      let resp: Response;
      try {
        resp = await fetch(`${baseURL}${path}`, {
          method,
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${loginToken}`,
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      } catch (err) {
        throw new Error(`[Erro] ${path}: ${err}`);
      }

      // Token expirado ou usuário desativado
      if (resp.status === 401) {
        logout();
        navigate("/login");
      }

      const data = resp.status === 204 ? null : await resp.json().catch(() => null);
      return { status: resp.status, ok: resp.ok, data: data as T };
    },
    [loginToken, logout, navigate],
  );

  return useMemo(
    () => ({
      // ==== USUÁRIOS ====
      async login(username: string, pw: string) {
        const resp = await fetch(`${baseURL}/users/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", accept: "application/json" },
          body: new URLSearchParams({ username, password: pw }).toString(),
        });
        return { status: resp.status, ok: resp.ok, data: await resp.json() };
      },
      getMe: () => request<Usuario>("GET", "/users/me"),
      getUsuarios: () => request<Usuario[]>("GET", "/users/"),
      getEquipe: () => request<MembroEquipe[]>("GET", "/users/equipe"),
      criarUsuario: (dados: Partial<Usuario> & { senha: string }) => request<Usuario>("POST", "/users/", dados),
      atualizarUsuario: (id: string, dados: Partial<Usuario> & { senha?: string }) =>
        request<Usuario>("PUT", `/users/${id}`, dados),

      // ==== PRODUTOS ====
      getProdutos: (filtros: { categoria?: string; ativo?: boolean; busca?: string } = {}) =>
        request<Produto[]>("GET", `/produtos/${query(filtros)}`),
      criarProduto: (dados: Partial<Produto>) => request<Produto>("POST", "/produtos/", dados),
      atualizarProduto: (id: string, dados: Partial<Produto> & { aplicar_custo_vendas_sem_custo?: boolean }) => request<Produto>("PUT", `/produtos/${id}`, dados),

      // ==== INGREDIENTES ====
      getIngredientes: (filtros: { tipo?: string; ativo?: boolean } = {}) =>
        request<Ingrediente[]>("GET", `/ingredientes/${query(filtros)}`),
      criarIngrediente: (dados: Partial<Ingrediente>) => request<Ingrediente>("POST", "/ingredientes/", dados),
      atualizarIngrediente: (id: string, dados: Partial<Ingrediente>) =>
        request<Ingrediente>("PUT", `/ingredientes/${id}`, dados),
      excluirIngrediente: (id: string) => request<null>("DELETE", `/ingredientes/${id}`),

      // ==== ESTOQUE ====
      getEntradas: (filtros: Partial<Periodo> & { ingrediente_id?: string; produto_id?: string } = {}) =>
        request<EntradaEstoque[]>("GET", `/entradas-estoque/${query({ ...filtros })}`),
      registrarEntrada: (dados: {
        produto_id?: string;
        ingrediente_id?: string;
        quantidade: number;
        custo_total: number;
        condicao_garrafa?: CondicaoGarrafa;
        observacao?: string;
      }) => request<EntradaEstoque>("POST", "/entradas-estoque/", dados),
      getDescartes: (periodo: Partial<Periodo> = {}) =>
        request<Descarte[]>("GET", `/descartes/${query({ ...periodo })}`),
      registrarDescarte: (dados: {
        produto_id?: string;
        ingrediente_id?: string;
        quantidade: number;
        motivo: string;
        entrada_estoque_id?: string;
      }) => request<Descarte>("POST", "/descartes/", dados),
      getProducoes: (periodo: Partial<Periodo> = {}) =>
        request<Producao[]>("GET", `/producoes/${query({ ...periodo })}`),
      registrarProducao: (dados: {
        produto_id: string;
        quantidade_produzida: number;
        polpa_usada: number;
        acucar_usado: number;
      }) => request<Producao>("POST", "/producoes/", dados),

      // ==== VENDAS ====
      getVendas: (filtros: Partial<Periodo> & { forma_pagamento?: string; incluir_canceladas?: boolean } = {}) =>
        request<Venda[]>("GET", `/vendas/${query(filtros)}`),
      criarVenda: (dados: {
        itens: { produto_id: string; quantidade: number }[];
        forma_pagamento: FormaPagamento;
        cliente_id?: string;
        observacao?: string;
      }) => request<Venda>("POST", "/vendas/", dados),
      cancelarVenda: (id: string, motivo: string) => request<Venda>("POST", `/vendas/${id}/cancelar`, { motivo }),

      // ==== CLIENTES ====
      getClientes: (busca = "") => request<Cliente[]>("GET", `/clientes/${query({ busca, ativo: true })}`),
      getCliente: (id: string) => request<Cliente>("GET", `/clientes/${id}`),
      criarCliente: (dados: { nome: string; telefone?: string; observacao?: string; endereco?: EnderecoForm }) =>
        request<Cliente>("POST", "/clientes/", dados),
      atualizarCliente: (id: string, dados: Partial<Cliente>) => request<Cliente>("PUT", `/clientes/${id}`, dados),
      getEnderecos: (id: string) => request<Endereco[]>("GET", `/clientes/${id}/enderecos`),
      cadastrarEndereco: (id: string, dados: EnderecoForm) =>
        request<Endereco>("POST", `/clientes/${id}/enderecos`, dados),
      confirmarEndereco: (idCliente: string, idEndereco: string) =>
        request<Endereco>("POST", `/clientes/${idCliente}/enderecos/${idEndereco}/confirmar`),

      // ==== PEDIDOS DE ENTREGA ====
      getPedidos: (filtros: Partial<Periodo> & { abertos?: boolean } = {}) =>
        request<Pedido[]>("GET", `/pedidos/${query({ ...filtros })}`),
      criarPedido: (dados: {
        cliente_id: string;
        itens: { produto_id: string; quantidade: number }[];
        forma_pagamento?: FormaPagamento | null;
        observacao?: string | null;
      }) => request<Pedido>("POST", "/pedidos/", dados),
      atualizarPedido: (
        id: string,
        dados: {
          itens?: { produto_id: string; quantidade: number }[];
          endereco_id?: string | null;
          forma_pagamento?: FormaPagamento | null;
          observacao?: string | null;
        },
      ) => request<Pedido>("PUT", `/pedidos/${id}`, dados),
      entregarPedido: (id: string, dados: { entregador_id: string; taxa_entrega: number; forma_pagamento: FormaPagamento }) =>
        request<Pedido>("POST", `/pedidos/${id}/entregar`, dados),
      cancelarPedido: (id: string, motivo: string) => request<Pedido>("POST", `/pedidos/${id}/cancelar`, { motivo }),
      getResumoEntregadores: (periodo: Partial<Periodo> = {}) =>
        request<EntregadorResumo[]>("GET", `/pedidos/entregadores${query({ ...periodo })}`),

      // ==== FIADO ====
      getDevedores: () => request<Devedor[]>("GET", "/fiado/devedores"),
      getExtratoFiado: (idCliente: string) => request<ExtratoFiado>("GET", `/fiado/clientes/${idCliente}`),
      registrarPagamentoFiado: (dados: {
        cliente_id: string;
        valor: number;
        forma_pagamento: FormaPagamento;
        observacao?: string;
      }) => request<PagamentoFiado>("POST", "/fiado/pagamentos", dados),

      // ==== TAXAS DA MAQUININHA ====
      getTaxas: () => request<TaxaPagamento[]>("GET", "/taxas-pagamento/"),
      atualizarTaxa: (forma: FormaPagamento, dados: { percentual?: number; repassar_cliente?: boolean }) =>
        request<TaxaPagamento>("PUT", `/taxas-pagamento/${forma}`, dados),

      // ==== RELATÓRIOS ====
      getResumo: (periodo: Periodo) => request<ResumoRelatorio>("GET", `/relatorios/resumo${query({ ...periodo })}`),
      getRelatorioProdutos: (periodo: Periodo) =>
        request<ProdutoRelatorio[]>("GET", `/relatorios/produtos${query({ ...periodo })}`),
      getVendasPorDia: (periodo: Periodo) =>
        request<VendaPorDia[]>("GET", `/relatorios/por-dia${query({ ...periodo })}`),
      getVendasPorDiaSemana: (periodo: Periodo) =>
        request<VendaPorDiaSemana[]>("GET", `/relatorios/por-dia-semana${query({ ...periodo })}`),
      getRelatorioEstoque: () => request<RelatorioEstoque>("GET", "/relatorios/estoque-diario"),
      enviarRelatorioEstoque: () =>
        request<{ destinatarios: number }>("POST", "/relatorios/estoque-diario/enviar"),
      getHorariosPico: (periodo: Periodo) =>
        request<HorarioPico[]>("GET", `/relatorios/horarios-pico${query({ ...periodo })}`),
    }),
    [request],
  );
}
