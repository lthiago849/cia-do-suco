import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, ShoppingCart, Trash, UserPlus } from "@phosphor-icons/react";

import { mensagemErro, useFetchData } from "../../Hooks/FetchData/useFetchData";
import { CategoriaProduto, Cliente, FormaPagamento, Produto, TaxaPagamento } from "../../Interfaces";
import { NOMES_CATEGORIA, NOMES_FORMA_PAGAMENTO, moeda } from "../../Utils/formatar";
import BuscaCliente from "../../PagesSections/BuscaCliente/BuscaCliente";
import { acrescimoCartao, percentualTexto } from "../../Utils/taxa";
import NovoClienteModal from "../Clientes/NovoClienteModal";
import style from "./PDV.module.css";

type Carrinho = Record<string, number>;

const FORMAS: FormaPagamento[] = ["PIX", "DINHEIRO", "DEBITO", "CREDITO", "FIADO"];

export default function PDV() {
  const { getProdutos, getTaxas, criarVenda } = useFetchData();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categoria, setCategoria] = useState<CategoriaProduto | "TODOS">("TODOS");
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<Carrinho>({});
  const [forma, setForma] = useState<FormaPagamento>("PIX");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [novoCliente, setNovoCliente] = useState(false);
  const [taxas, setTaxas] = useState<TaxaPagamento[]>([]);

  const carregarProdutos = useCallback(async () => {
    const resp = await getProdutos({ ativo: true });
    if (resp.ok) setProdutos(resp.data);
    else toast.error(mensagemErro(resp.data));
  }, [getProdutos]);

  useEffect(() => {
    carregarProdutos();
    getTaxas().then((resp) => resp.ok && setTaxas(resp.data));
  }, [carregarProdutos, getTaxas]);

  const porId = useMemo(() => Object.fromEntries(produtos.map((p) => [p.id, p])), [produtos]);

  const visiveis = produtos.filter(
    (p) =>
      (categoria === "TODOS" || p.categoria === categoria) &&
      p.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );

  const itens = Object.entries(carrinho)
    .filter(([id]) => porId[id])
    .map(([id, quantidade]) => ({ produto: porId[id], quantidade }));
  const total = itens.reduce((soma, { produto, quantidade }) => soma + produto.preco_venda * quantidade, 0);
  const qtdItens = itens.reduce((soma, { quantidade }) => soma + quantidade, 0);
  // O valor oficial é calculado no servidor ao registrar a venda
  const acrescimo = acrescimoCartao(total, forma, taxas);
  const totalCobrado = total + acrescimo;

  function alterarQuantidade(produto: Produto, delta: number) {
    setCarrinho((atual) => {
      const nova = Math.min((atual[produto.id] ?? 0) + delta, produto.quantidade_estoque);
      const { [produto.id]: _removido, ...resto } = atual;
      void _removido;
      return nova > 0 ? { ...resto, [produto.id]: nova } : resto;
    });
  }

  async function finalizar() {
    if (forma === "FIADO" && !cliente) {
      toast.warning("Escolha o cliente para vender fiado.");
      return;
    }
    setEnviando(true);
    try {
      const resp = await criarVenda({
        itens: itens.map(({ produto, quantidade }) => ({ produto_id: produto.id, quantidade })),
        forma_pagamento: forma,
        cliente_id: cliente?.id,
        observacao: observacao.trim() || undefined,
      });
      if (!resp.ok) {
        toast.error(mensagemErro(resp.data));
        await carregarProdutos();
        return;
      }
      const cobrado = resp.data.valor_total + resp.data.acrescimo_pagamento;
      toast.success(
        `Venda de ${moeda(cobrado)} registrada` +
          (forma === "FIADO" ? ` no fiado de ${cliente?.nome}` : ` (${NOMES_FORMA_PAGAMENTO[forma]})`),
      );
      setCarrinho({});
      setCliente(null);
      setObservacao("");
      setForma("PIX");
      await carregarProdutos();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={style.pdv}>
      <section className={style.catalogo}>
        <div className="abas">
          {(["TODOS", "SUCO", "PICOLE", "MORENINHA", "CREMOSINHO"] as const).map((c) => (
            <button key={c} className={`aba ${categoria === c ? "ativa" : ""}`} onClick={() => setCategoria(c)}>
              {c === "TODOS" ? "Todos" : NOMES_CATEGORIA[c]}
            </button>
          ))}
        </div>
        <input
          className="input"
          placeholder="Buscar sabor..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        {visiveis.length === 0 ? (
          <p className="vazio">Nenhum produto encontrado.</p>
        ) : (
          <div className={style.grade}>
            {visiveis.map((produto) => {
              const noCarrinho = carrinho[produto.id] ?? 0;
              const esgotado = produto.quantidade_estoque === 0;
              const restante = produto.quantidade_estoque - noCarrinho;
              return (
                <button
                  key={produto.id}
                  className={`${style.produto} ${noCarrinho ? style.produtoSelecionado : ""}`}
                  disabled={restante <= 0}
                  onClick={() => alterarQuantidade(produto, 1)}
                >
                  <span className={style.categoria}>{NOMES_CATEGORIA[produto.categoria]}</span>
                  <strong>{produto.nome}</strong>
                  <span className={style.preco}>{moeda(produto.preco_venda)}</span>
                  <span
                    className={`badge ${esgotado ? "badge-perigo" : produto.quantidade_estoque <= 5 ? "badge-alerta" : "badge-verde"}`}
                  >
                    {esgotado ? "Esgotado" : `${restante} disponíve${restante === 1 ? "l" : "is"}`}
                  </span>
                  {noCarrinho > 0 && <span className={style.contador}>{noCarrinho}</span>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <aside className={`card ${style.carrinho}`}>
        <h2>
          <ShoppingCart size={20} weight="duotone" /> Venda atual
        </h2>

        {itens.length === 0 ? (
          <p className="vazio">Toque nos produtos para adicionar.</p>
        ) : (
          <ul className={style.itens}>
            {itens.map(({ produto, quantidade }) => (
              <li key={produto.id}>
                <div className={style.itemNome}>
                  <strong>{produto.nome}</strong>
                  <span className="texto-suave">
                    {NOMES_CATEGORIA[produto.categoria]} · {moeda(produto.preco_venda)}
                  </span>
                </div>
                <div className={style.quantidade}>
                  <button className="btn btn-pequeno" onClick={() => alterarQuantidade(produto, -1)} aria-label="Menos">
                    <Minus size={14} />
                  </button>
                  <span>{quantidade}</span>
                  <button
                    className="btn btn-pequeno"
                    onClick={() => alterarQuantidade(produto, 1)}
                    disabled={quantidade >= produto.quantidade_estoque}
                    aria-label="Mais"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    className="btn btn-pequeno btn-perigo"
                    onClick={() => alterarQuantidade(produto, -quantidade)}
                    aria-label="Remover"
                  >
                    <Trash size={14} />
                  </button>
                </div>
                <span className={style.subtotal}>{moeda(produto.preco_venda * quantidade)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className={style.total}>
          <span>
            Total ({qtdItens} {qtdItens === 1 ? "item" : "itens"})
          </span>
          <strong>{moeda(total)}</strong>
        </div>

        <div className={style.formas}>
          {FORMAS.map((f) => (
            <button key={f} className={`btn ${forma === f ? "btn-primario" : ""}`} onClick={() => setForma(f)}>
              {NOMES_FORMA_PAGAMENTO[f]}
            </button>
          ))}
        </div>

        {acrescimo > 0 && itens.length > 0 && (
          <div className={style.maquina}>
            <span>{forma === "PIX" ? "Valor do Pix" : "Passar na máquina"}</span>
            <strong>{moeda(totalCobrado)}</strong>
            <small>
              {moeda(total)} + {moeda(acrescimo)} de acréscimo do cartão ({percentualTexto(forma, taxas)})
            </small>
          </div>
        )}

        {forma === "FIADO" && (
          <div className={style.fiado}>
            <BuscaCliente selecionado={cliente} onSelecionar={setCliente} />
            {!cliente && (
              <button className="btn btn-pequeno" onClick={() => setNovoCliente(true)}>
                <UserPlus size={16} /> Cadastrar cliente novo
              </button>
            )}
          </div>
        )}

        <input
          className="input"
          placeholder="Observação (opcional)"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />

        <button
          className="btn btn-primario btn-grande"
          disabled={itens.length === 0 || enviando || (forma === "FIADO" && !cliente)}
          onClick={finalizar}
        >
          {enviando ? "Registrando..." : `Finalizar venda · ${moeda(totalCobrado)}`}
        </button>
      </aside>

      <NovoClienteModal
        aberto={novoCliente}
        onFechar={() => setNovoCliente(false)}
        onCriado={(c) => {
          setCliente(c);
          setNovoCliente(false);
        }}
      />
    </div>
  );
}
