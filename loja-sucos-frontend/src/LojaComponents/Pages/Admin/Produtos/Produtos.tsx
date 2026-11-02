import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PencilSimple, Plus, Warning } from "@phosphor-icons/react";

import { mensagemErro, useFetchData } from "../../../Hooks/FetchData/useFetchData";
import { CategoriaProduto, Ingrediente, Produto } from "../../../Interfaces";
import { NOMES_CATEGORIA, NOMES_UNIDADE, lerNumero, moeda } from "../../../Utils/formatar";
import Modal from "../../../PagesSections/Modal/Modal";

interface FormProduto {
  nome: string;
  categoria: CategoriaProduto;
  ingrediente_id: string;
  preco_venda: string;
  custo_unitario: string;
  quantidade_estoque: string;
  descricao: string;
  ativo: boolean;
  corrigirCusto: boolean;
  aplicarVendas: boolean;
}

const FORM_VAZIO: FormProduto = {
  nome: "",
  categoria: "SUCO",
  ingrediente_id: "",
  preco_venda: "",
  custo_unitario: "",
  quantidade_estoque: "",
  descricao: "",
  ativo: true,
  corrigirCusto: false,
  aplicarVendas: false,
};

/** Suco produzido com estoque ou vendas mas sem custo: estoque lançado à mão, sem passar pela Produção */
const semCusto = (p: Produto) => !p.custo_unitario && (p.quantidade_estoque > 0 || !!p.vendidos_sem_custo);

const virgula = (n: number) => String(n).replace(".", ",");

export default function Produtos() {
  const { getProdutos, getIngredientes, criarProduto, atualizarProduto } = useFetchData();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<FormProduto>(FORM_VAZIO);

  const carregar = useCallback(async () => {
    const [p, i] = await Promise.all([getProdutos(), getIngredientes({ ativo: true })]);
    if (p.ok) setProdutos(p.data);
    if (i.ok) setIngredientes(i.data);
  }, [getProdutos, getIngredientes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const bases = ingredientes.filter((ing) => ing.tipo === "POLPA" || ing.tipo === "FRUTA");
  const pendentes = produtos.filter((p) => p.vendidos_sem_custo);

  function abrir(produto: Produto | null) {
    setEditando(produto);
    setForm(
      produto
        ? {
            nome: produto.nome,
            categoria: produto.categoria,
            ingrediente_id: produto.ingrediente_id ?? "",
            preco_venda: virgula(produto.preco_venda),
            custo_unitario: virgula(produto.custo_unitario ?? 0),
            quantidade_estoque: String(produto.quantidade_estoque),
            descricao: produto.descricao ?? "",
            ativo: produto.ativo,
            // Produzido sem custo: já abre com o campo liberado para informar
            corrigirCusto: !!produto.ingrediente_id && semCusto(produto),
            aplicarVendas: !!produto.vendidos_sem_custo,
          }
        : FORM_VAZIO,
    );
    setAberto(true);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const dados: Partial<Produto> & { aplicar_custo_vendas_sem_custo?: boolean } = {
      nome: form.nome.trim(),
      categoria: form.categoria,
      ingrediente_id: form.ingrediente_id || null,
      preco_venda: lerNumero(form.preco_venda),
      descricao: form.descricao.trim() || null,
      ativo: form.ativo,
    };
    // O custo de quem é produzido vem da produção; à mão só nos comprados prontos ou na correção
    const custoEditavel = !form.ingrediente_id || form.corrigirCusto;
    if (custoEditavel && form.custo_unitario) dados.custo_unitario = lerNumero(form.custo_unitario);
    if (editando?.vendidos_sem_custo && custoEditavel && form.aplicarVendas && lerNumero(form.custo_unitario) > 0) {
      dados.aplicar_custo_vendas_sem_custo = true;
    }
    if (editando && form.quantidade_estoque !== String(editando.quantidade_estoque)) {
      dados.quantidade_estoque = lerNumero(form.quantidade_estoque);
    }

    const resp = editando ? await atualizarProduto(editando.id, dados) : await criarProduto(dados);
    if (resp.ok) {
      toast.success(
        dados.aplicar_custo_vendas_sem_custo
          ? `Custo salvo e aplicado a ${editando?.vendidos_sem_custo} unidade(s) já vendida(s).`
          : editando
            ? "Produto atualizado."
            : "Produto cadastrado.",
      );
      setAberto(false);
      carregar();
    } else toast.error(mensagemErro(resp.data));
  }

  const set = <K extends keyof FormProduto>(campo: K, valor: FormProduto[K]) => setForm({ ...form, [campo]: valor });

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Produtos</h1>
          <p>Sabores, preços e custos. Produtos desativados somem do caixa, mas continuam no histórico.</p>
        </div>
        <button className="btn btn-primario" onClick={() => abrir(null)}>
          <Plus size={18} /> Novo produto
        </button>
      </div>

      {pendentes.length > 0 && (
        <div className="card aviso-alerta">
          <Warning size={20} weight="fill" />
          <div>
            <strong>
              {pendentes.length === 1 ? "1 produto foi vendido" : `${pendentes.length} produtos foram vendidos`} sem
              custo, então o lucro do painel está maior que o real.
            </strong>
            <p className="texto-suave">
              Acontece quando o estoque é lançado à mão, sem passar pela Produção. Toque no produto, informe quanto
              custa cada unidade e marque "usar esse custo nas vendas".
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="tabela-wrapper">
          <table className="tabela tabela-cartoes">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Sabor</th>
                <th>Origem</th>
                <th className="num">Preço</th>
                <th className="num">Custo</th>
                <th className="num">Margem</th>
                <th className="num">Estoque</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.id} className={p.ativo ? "" : "inativo"}>
                  <td data-rotulo="Categoria">{NOMES_CATEGORIA[p.categoria]}</td>
                  <td className="principal">
                    <strong>{p.nome}</strong>
                  </td>
                  <td className="texto-suave" data-rotulo="Origem">
                    {p.ingrediente_nome ? `Produzido (${p.ingrediente_nome})` : "Comprado pronto"}
                  </td>
                  <td className="num" data-rotulo="Preço">
                    {moeda(p.preco_venda)}
                  </td>
                  <td className="num" data-rotulo="Custo">
                    {semCusto(p) ? (
                      <span className="badge badge-alerta">
                        sem custo{p.vendidos_sem_custo ? ` · ${p.vendidos_sem_custo} vendido(s)` : ""}
                      </span>
                    ) : (
                      moeda(p.custo_unitario ?? 0)
                    )}
                  </td>
                  <td className="num" data-rotulo="Margem">
                    {p.preco_venda > 0
                      ? `${Math.round(((p.preco_venda - (p.custo_unitario ?? 0)) / p.preco_venda) * 100)}%`
                      : "—"}
                  </td>
                  <td className="num" data-rotulo="Estoque">
                    {p.quantidade_estoque}
                  </td>
                  <td className="num acao">
                    <button className="btn btn-pequeno" onClick={() => abrir(p)} aria-label="Editar">
                      <PencilSimple size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        titulo={editando ? `Editar ${editando.nome}` : "Novo produto"}
        aberto={aberto}
        onFechar={() => setAberto(false)}
      >
        <form onSubmit={salvar}>
          <div className="form-grid">
            <label className="campo">
              Sabor
              <input required value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </label>
            <label className="campo">
              Categoria
              <select value={form.categoria} onChange={(e) => set("categoria", e.target.value as CategoriaProduto)}>
                {Object.entries(NOMES_CATEGORIA).map(([valor, nome]) => (
                  <option key={valor} value={valor}>
                    {nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo" style={{ gridColumn: "1 / -1" }}>
              Fruta ou polpa usada na produção
              <select value={form.ingrediente_id} onChange={(e) => set("ingrediente_id", e.target.value)}>
                <option value="">Nenhuma — comprado pronto</option>
                {bases.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              Preço de venda (R$)
              <input
                required
                inputMode="decimal"
                value={form.preco_venda}
                onChange={(e) => set("preco_venda", e.target.value)}
              />
            </label>
            <label className="campo">
              Custo por unidade (R$)
              <input
                inputMode="decimal"
                disabled={!!form.ingrediente_id && !form.corrigirCusto}
                title={form.ingrediente_id ? "Calculado automaticamente pela produção" : undefined}
                value={form.custo_unitario}
                onChange={(e) => set("custo_unitario", e.target.value)}
              />
            </label>
            {editando && form.ingrediente_id && (
              <label className="campo-check" style={{ gridColumn: "1 / -1" }}>
                <input
                  type="checkbox"
                  checked={form.corrigirCusto}
                  onChange={(e) => set("corrigirCusto", e.target.checked)}
                />
                Corrigir custo manualmente
              </label>
            )}
            {form.ingrediente_id && form.corrigirCusto && editando?.custo_ultima_producao != null && (
              <div className="sugestao-custo" style={{ gridColumn: "1 / -1" }}>
                <span>
                  Na última produção, cada unidade custou <strong>{moeda(editando.custo_ultima_producao)}</strong>.
                </span>
                <button
                  type="button"
                  className="btn btn-pequeno"
                  onClick={() => set("custo_unitario", virgula(editando.custo_ultima_producao ?? 0))}
                >
                  Usar este valor
                </button>
              </div>
            )}
            {form.ingrediente_id && form.corrigirCusto && (
              <p className="texto-suave" style={{ gridColumn: "1 / -1" }}>
                {editando?.custo_ultima_producao == null && "Ainda não houve produção deste suco. "}
                Para calcular à mão, some o que vai em uma garrafa:{" "}
                {ingredientes
                  .filter(
                    (i) => i.id === form.ingrediente_id || i.tipo === "ACUCAR" || (i.tipo === "GARRAFA" && i.ativo),
                  )
                  .map((i) => `${i.nome} (${moeda(i.custo_unitario ?? 0)}/${NOMES_UNIDADE[i.unidade_medida]})`)
                  .join(" + ")}
                , cada um na quantidade usada em uma garrafa.
              </p>
            )}
            {!!editando?.vendidos_sem_custo && (!form.ingrediente_id || form.corrigirCusto) && (
              <label className="campo-check" style={{ gridColumn: "1 / -1" }}>
                <input
                  type="checkbox"
                  checked={form.aplicarVendas}
                  onChange={(e) => set("aplicarVendas", e.target.checked)}
                />
                Usar esse custo também nas {editando.vendidos_sem_custo} unidade(s) já vendida(s) sem custo (corrige o
                lucro do painel)
              </label>
            )}
            {editando && (
              <label className="campo">
                Estoque (ajuste manual)
                <input
                  inputMode="numeric"
                  value={form.quantidade_estoque}
                  onChange={(e) => set("quantidade_estoque", e.target.value)}
                />
              </label>
            )}
            <label className="campo" style={{ gridColumn: "1 / -1" }}>
              Descrição
              <input value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
            </label>
            <label className="campo-check">
              <input type="checkbox" checked={form.ativo} onChange={(e) => set("ativo", e.target.checked)} />
              Ativo (aparece no caixa)
            </label>
          </div>
          <p className="texto-suave" style={{ marginTop: "0.8rem" }}>
            Para entrada de mercadoria use Estoque → Registrar compra, que também atualiza o custo médio.
          </p>
          <div className="form-acoes">
            <button type="button" className="btn" onClick={() => setAberto(false)}>
              Cancelar
            </button>
            <button className="btn btn-primario">Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
