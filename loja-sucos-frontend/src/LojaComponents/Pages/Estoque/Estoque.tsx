import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash } from "@phosphor-icons/react";

import { useGlobalContext } from "../../GlobalContext";
import { mensagemErro, useFetchData } from "../../Hooks/FetchData/useFetchData";
import { CondicaoGarrafa, Descarte, EntradaEstoque, Ingrediente, Produto } from "../../Interfaces";
import {
  NOMES_CATEGORIA,
  NOMES_TIPO_INGREDIENTE,
  NOMES_UNIDADE,
  dataHora,
  lerNumero,
  moeda,
  numero,
} from "../../Utils/formatar";
import Modal from "../../PagesSections/Modal/Modal";
import SelecaoBusca, { OpcaoBusca } from "../../PagesSections/SelecaoBusca/SelecaoBusca";

type Aba = "produtos" | "ingredientes" | "compras" | "descartes";

const NOMES_CONDICAO: Record<CondicaoGarrafa, string> = { LIMPA: "Limpas", SUJA: "Sujas" };

export default function Estoque() {
  const { account } = useGlobalContext();
  const { getProdutos, getIngredientes, getEntradas, getDescartes } = useFetchData();
  const [aba, setAba] = useState<Aba>("produtos");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [entradas, setEntradas] = useState<EntradaEstoque[]>([]);
  const [descartes, setDescartes] = useState<Descarte[]>([]);
  const [compraAberta, setCompraAberta] = useState(false);
  const [descarteAberto, setDescarteAberto] = useState(false);

  const ehAdmin = account.usuario?.tipo === "ADMIN";

  const carregar = useCallback(async () => {
    const [p, i, e, d] = await Promise.all([
      getProdutos({ ativo: true }),
      getIngredientes({ ativo: true }),
      getEntradas(),
      getDescartes(),
    ]);
    if (p.ok) setProdutos(p.data);
    if (i.ok) setIngredientes(i.data);
    if (e.ok) setEntradas(e.data);
    if (d.ok) setDescartes(d.data);
    if (!p.ok) toast.error(mensagemErro(p.data));
  }, [getProdutos, getIngredientes, getEntradas, getDescartes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Estoque</h1>
          <p>O que temos para vender e os ingredientes da produção.</p>
        </div>
        <div className="filtros">
          <button className="btn" onClick={() => setDescarteAberto(true)}>
            <Trash size={18} /> Registrar descarte
          </button>
          <button className="btn btn-primario" onClick={() => setCompraAberta(true)}>
            <Plus size={18} /> Registrar compra
          </button>
        </div>
      </div>

      <div className="abas">
        <button className={`aba ${aba === "produtos" ? "ativa" : ""}`} onClick={() => setAba("produtos")}>
          Produtos
        </button>
        <button className={`aba ${aba === "ingredientes" ? "ativa" : ""}`} onClick={() => setAba("ingredientes")}>
          Ingredientes
        </button>
        <button className={`aba ${aba === "compras" ? "ativa" : ""}`} onClick={() => setAba("compras")}>
          Últimas compras
        </button>
        <button className={`aba ${aba === "descartes" ? "ativa" : ""}`} onClick={() => setAba("descartes")}>
          Descartes
        </button>
      </div>

      <div className="card">
        {aba === "produtos" && (
          <div className="tabela-wrapper">
            <table className="tabela tabela-cartoes">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Sabor</th>
                  <th className="num">Preço</th>
                  {ehAdmin && <th className="num">Custo</th>}
                  <th className="num">Disponível</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => (
                  <tr key={p.id}>
                    <td data-rotulo="Categoria">{NOMES_CATEGORIA[p.categoria]}</td>
                    <td className="principal">
                      <strong>{p.nome}</strong>
                    </td>
                    <td className="num" data-rotulo="Preço">
                      {moeda(p.preco_venda)}
                    </td>
                    {ehAdmin && (
                      <td className="num" data-rotulo="Custo">
                        {moeda(p.custo_unitario ?? 0)}
                      </td>
                    )}
                    <td className="num" data-rotulo="Disponível">
                      <span
                        className={`badge ${p.quantidade_estoque === 0 ? "badge-perigo" : p.quantidade_estoque <= 5 ? "badge-alerta" : "badge-verde"}`}
                      >
                        {p.quantidade_estoque === 0 ? "Esgotado" : p.quantidade_estoque}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {aba === "ingredientes" && (
          <div className="tabela-wrapper">
            <table className="tabela tabela-cartoes">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Ingrediente</th>
                  {ehAdmin && <th className="num">Custo médio</th>}
                  <th className="num">Em estoque</th>
                </tr>
              </thead>
              <tbody>
                {ingredientes.map((i) => (
                  <tr key={i.id}>
                    <td data-rotulo="Tipo">{NOMES_TIPO_INGREDIENTE[i.tipo]}</td>
                    <td className="principal">
                      <strong>{i.nome}</strong>
                    </td>
                    {ehAdmin && (
                      <td className="num" data-rotulo="Custo médio">
                        {moeda(i.custo_unitario ?? 0)}/{NOMES_UNIDADE[i.unidade_medida]}
                      </td>
                    )}
                    <td className="num" data-rotulo="Em estoque">
                      <span className={`badge ${i.quantidade_estoque <= 0 ? "badge-perigo" : ""}`}>
                        {numero(i.quantidade_estoque)} {NOMES_UNIDADE[i.unidade_medida]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {aba === "compras" &&
          (entradas.length === 0 ? (
            <p className="vazio">Nenhuma compra registrada.</p>
          ) : (
            <div className="tabela-wrapper">
              <table className="tabela tabela-cartoes">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Item</th>
                    <th className="num">Quantidade</th>
                    <th className="num">Descartadas</th>
                    {ehAdmin && <th className="num">Valor pago</th>}
                    <th>Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {entradas.map((e) => (
                    <tr key={e.id}>
                      <td data-rotulo="Quando">{dataHora(e.created_at)}</td>
                      <td className="principal">
                        <div>
                          {e.item_nome}{" "}
                          {e.condicao_garrafa && (
                            <span className={`badge ${e.condicao_garrafa === "SUJA" ? "badge-alerta" : "badge-verde"}`}>
                              {NOMES_CONDICAO[e.condicao_garrafa]}
                            </span>
                          )}
                          {e.observacao && <div className="texto-suave">{e.observacao}</div>}
                        </div>
                      </td>
                      <td className="num" data-rotulo="Quantidade">
                        {numero(e.quantidade)}
                      </td>
                      <td className="num" data-rotulo="Descartadas">
                        {e.quantidade_descartada > 0 ? (
                          <span className="texto-perigo">{numero(e.quantidade_descartada)}</span>
                        ) : (
                          <span className="texto-suave">—</span>
                        )}
                      </td>
                      {ehAdmin && (
                        <td className="num" data-rotulo="Valor pago">
                          {moeda(e.custo_total ?? 0)}
                        </td>
                      )}
                      <td data-rotulo="Registrado por">{e.usuario_nome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {aba === "descartes" &&
          (descartes.length === 0 ? (
            <p className="vazio">Nenhum descarte registrado.</p>
          ) : (
            <div className="tabela-wrapper">
              <table className="tabela tabela-cartoes">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Item</th>
                    <th className="num">Quantidade</th>
                    {ehAdmin && <th className="num">Valor perdido</th>}
                    <th>Motivo</th>
                    <th>Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {descartes.map((d) => (
                    <tr key={d.id}>
                      <td data-rotulo="Quando">{dataHora(d.created_at)}</td>
                      <td className="principal">
                        <strong>{d.item_nome}</strong>
                      </td>
                      <td className="num" data-rotulo="Quantidade">
                        {numero(d.quantidade)}
                      </td>
                      {ehAdmin && (
                        <td className="num texto-perigo" data-rotulo="Valor perdido">
                          {moeda(d.valor_perdido ?? 0)}
                        </td>
                      )}
                      <td data-rotulo="Motivo">{d.motivo}</td>
                      <td data-rotulo="Registrado por">{d.usuario_nome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>

      <CompraModal
        aberto={compraAberta}
        onFechar={() => setCompraAberta(false)}
        produtos={produtos.filter((p) => p.ingrediente_id === null)}
        ingredientes={ingredientes}
        onSalvo={() => {
          setCompraAberta(false);
          carregar();
        }}
      />

      <DescarteModal
        aberto={descarteAberto}
        onFechar={() => setDescarteAberto(false)}
        ingredientes={ingredientes}
        produtos={produtos}
        onSalvo={() => {
          setDescarteAberto(false);
          setAba("descartes");
          carregar();
        }}
      />
    </div>
  );
}

interface CompraModalProps {
  aberto: boolean;
  onFechar: () => void;
  produtos: Produto[];
  ingredientes: Ingrediente[];
  onSalvo: () => void;
}

/** Compra de ingrediente (polpa, açúcar) ou de produto pronto (picolé, moreninha, cremosinho) */
function CompraModal({ aberto, onFechar, produtos, ingredientes, onSalvo }: CompraModalProps) {
  const { registrarEntrada } = useFetchData();
  const [alvo, setAlvo] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [valor, setValor] = useState("");
  const [condicao, setCondicao] = useState<CondicaoGarrafa | null>(null);
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [tipo, id] = alvo.split(":");
  const ehGarrafa = tipo === "ingrediente" && ingredientes.find((i) => i.id === id)?.tipo === "GARRAFA";
  const qtd = lerNumero(quantidade);
  const total = lerNumero(valor);
  const valido =
    !!id && qtd > 0 && total >= 0 && (tipo !== "produto" || Number.isInteger(qtd)) && (!ehGarrafa || !!condicao);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const resp = await registrarEntrada({
        ...(tipo === "produto" ? { produto_id: id } : { ingrediente_id: id }),
        quantidade: qtd,
        custo_total: total,
        condicao_garrafa: ehGarrafa && condicao ? condicao : undefined,
        observacao: observacao.trim() || undefined,
      });
      if (resp.ok) {
        toast.success(`Compra de ${resp.data.item_nome} registrada.`);
        setAlvo("");
        setQuantidade("");
        setValor("");
        setCondicao(null);
        setObservacao("");
        onSalvo();
      } else toast.error(mensagemErro(resp.data));
    } finally {
      setEnviando(false);
    }
  }

  const unidade =
    tipo === "ingrediente" ? NOMES_UNIDADE[ingredientes.find((i) => i.id === id)?.unidade_medida ?? "UN"] : "un";

  return (
    <Modal titulo="Registrar compra" aberto={aberto} onFechar={onFechar}>
      <form onSubmit={salvar}>
        <div className="form-grid">
          <div className="campo" style={{ gridColumn: "1 / -1" }}>
            O que chegou
            <SelecaoBusca
              opcoes={opcoesItens(ingredientes, produtos, "Produtos prontos")}
              valor={alvo}
              onChange={setAlvo}
              placeholder="Digite (ex.: garrafa, polpa de caju, picolé)"
            />
          </div>
          {ehGarrafa && (
            <div className="campo" style={{ gridColumn: "1 / -1" }}>
              Como as garrafas vieram?
              <div className="filtros">
                {(["LIMPA", "SUJA"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`btn ${condicao === c ? "btn-primario" : ""}`}
                    onClick={() => setCondicao(c)}
                  >
                    {NOMES_CONDICAO[c]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="campo">
            Quantidade ({unidade})
            <input inputMode="decimal" required value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </label>
          <label className="campo">
            Valor pago no total (R$)
            <input
              inputMode="decimal"
              required
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </label>
          <label className="campo" style={{ gridColumn: "1 / -1" }}>
            Observação
            <input
              placeholder="Fornecedor, nota..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </label>
        </div>
        {qtd > 0 && total >= 0 && (
          <p className="texto-suave" style={{ marginTop: "0.8rem" }}>
            Custo por {unidade}: {moeda(total / qtd)}
          </p>
        )}
        <div className="form-acoes">
          <button type="button" className="btn" onClick={onFechar}>
            Cancelar
          </button>
          <button className="btn btn-primario" disabled={!valido || enviando}>
            Registrar compra
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Opções da busca de item (compra e descarte): valor "ingrediente:<id>" ou "produto:<id>", com o estoque atual */
function opcoesItens(ingredientes: Ingrediente[], produtos: Produto[], grupoProdutos: string): OpcaoBusca[] {
  return [
    ...ingredientes.map((i) => ({
      valor: `ingrediente:${i.id}`,
      rotulo: i.nome,
      detalhe: `tem ${numero(i.quantidade_estoque)} ${NOMES_UNIDADE[i.unidade_medida]}`,
      grupo: "Ingredientes",
    })),
    ...produtos.map((p) => ({
      valor: `produto:${p.id}`,
      rotulo: `${NOMES_CATEGORIA[p.categoria]} — ${p.nome}`,
      detalhe: `tem ${p.quantidade_estoque}`,
      grupo: grupoProdutos,
    })),
  ];
}

interface DescarteModalProps {
  aberto: boolean;
  onFechar: () => void;
  ingredientes: Ingrediente[];
  produtos: Produto[];
  onSalvo: () => void;
}

const MOTIVOS_RAPIDOS = ["Estragou", "Venceu", "Derreteu", "Caiu/quebrou", "Sujas demais, nem lavando saiu"];

/** Registra o que foi jogado fora (garrafas sujas, suco que estragou...). O custo é repassado ao que sobrou. */
function DescarteModal({ aberto, onFechar, ingredientes, produtos, onSalvo }: DescarteModalProps) {
  const { getEntradas, registrarDescarte } = useFetchData();
  const garrafa = ingredientes.find((i) => i.tipo === "GARRAFA");
  const [alvo, setAlvo] = useState("");
  const [compras, setCompras] = useState<EntradaEstoque[]>([]);
  const [compraId, setCompraId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [tipo, id] = alvo.split(":");
  const ehProduto = tipo === "produto";

  // Abre já com a garrafa selecionada, que é o caso mais comum
  useEffect(() => {
    if (aberto && !alvo && garrafa) setAlvo(`ingrediente:${garrafa.id}`);
  }, [aberto, alvo, garrafa]);

  useEffect(() => {
    setCompraId("");
    if (!id) return setCompras([]);
    getEntradas(tipo === "produto" ? { produto_id: id } : { ingrediente_id: id }).then(
      (resp) => resp.ok && setCompras(resp.data.slice(0, 20)),
    );
  }, [tipo, id, getEntradas]);

  const item = ehProduto ? produtos.find((p) => p.id === id) : ingredientes.find((i) => i.id === id);
  const unidade = item && !ehProduto ? NOMES_UNIDADE[(item as Ingrediente).unidade_medida] : "un";
  const compra = compras.find((c) => c.id === compraId);
  const qtd = lerNumero(quantidade);
  const limiteCompra = compra ? compra.quantidade - compra.quantidade_descartada : Infinity;
  const limite = Math.min(item?.quantidade_estoque ?? 0, limiteCompra);
  const valido =
    !!item && qtd > 0 && qtd <= limite && (!ehProduto || Number.isInteger(qtd)) && motivo.trim().length >= 3;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const resp = await registrarDescarte({
        ...(ehProduto ? { produto_id: id } : { ingrediente_id: id }),
        quantidade: qtd,
        motivo: motivo.trim(),
        entrada_estoque_id: compraId || undefined,
      });
      if (resp.ok) {
        toast.success(
          `Descarte registrado: ${numero(resp.data.quantidade)} ${resp.data.item_nome}` +
            (resp.data.valor_perdido !== null ? ` · ${moeda(resp.data.valor_perdido)} perdidos.` : "."),
        );
        setQuantidade("");
        setMotivo("");
        setCompraId("");
        setAlvo("");
        onSalvo();
      } else toast.error(mensagemErro(resp.data));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo="Registrar descarte" aberto={aberto} onFechar={onFechar}>
      <form onSubmit={salvar}>
        <div className="form-grid">
          <div className="campo" style={{ gridColumn: "1 / -1" }}>
            O que foi descartado
            <SelecaoBusca
              opcoes={opcoesItens(ingredientes, produtos, "Produtos")}
              valor={alvo}
              onChange={setAlvo}
              placeholder="Digite (ex.: garrafa, suco de caju)"
            />
          </div>
          {compras.length > 0 && (
            <label className="campo" style={{ gridColumn: "1 / -1" }}>
              De qual compra (opcional)
              <select value={compraId} onChange={(e) => setCompraId(e.target.value)}>
                <option value="">Não sei / não importa</option>
                {compras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {dataHora(c.created_at)} — {numero(c.quantidade)} {unidade}
                    {c.condicao_garrafa ? ` ${NOMES_CONDICAO[c.condicao_garrafa].toLowerCase()}` : ""}
                    {c.quantidade_descartada > 0 ? ` (${numero(c.quantidade_descartada)} já descartadas)` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="campo">
            Quantidade ({unidade})
            <input inputMode="decimal" required value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </label>
          <label className="campo" style={{ gridColumn: "1 / -1" }}>
            Motivo
            <input
              required
              placeholder='Ex.: "estragou", "sujas demais, nem lavando saiu"'
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <div className="filtros" style={{ gridColumn: "1 / -1" }}>
            {MOTIVOS_RAPIDOS.map((m) => (
              <button key={m} type="button" className="btn btn-pequeno" onClick={() => setMotivo(m)}>
                {m}
              </button>
            ))}
          </div>
        </div>
        {item && qtd > 0 && (
          <p className={qtd > limite ? "texto-perigo" : "texto-suave"} style={{ marginTop: "0.8rem" }}>
            {qtd > limite
              ? `Máximo para descartar: ${numero(limite)} ${unidade}.`
              : ehProduto && !Number.isInteger(qtd)
                ? "Produto é descartado em unidades inteiras."
                : item.custo_unitario !== null
                  ? `Perda estimada: ${moeda(qtd * item.custo_unitario)}. Esse valor passa a pesar no custo do que sobrou.`
                  : "O descarte fica registrado com seu nome e o motivo."}
          </p>
        )}
        <div className="form-acoes">
          <button type="button" className="btn" onClick={onFechar}>
            Cancelar
          </button>
          <button className="btn btn-primario" disabled={!valido || enviando}>
            Registrar descarte
          </button>
        </div>
      </form>
    </Modal>
  );
}
