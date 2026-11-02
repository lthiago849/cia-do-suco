import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PencilSimple, Plus, Trash } from "@phosphor-icons/react";

import { mensagemErro, useFetchData } from "../../../Hooks/FetchData/useFetchData";
import { Ingrediente, TipoIngrediente, UnidadeMedida } from "../../../Interfaces";
import { NOMES_TIPO_INGREDIENTE, NOMES_UNIDADE, data, lerNumero, moeda, numero } from "../../../Utils/formatar";
import Modal from "../../../PagesSections/Modal/Modal";

interface FormIngrediente {
  nome: string;
  tipo: TipoIngrediente;
  unidade_medida: UnidadeMedida;
  custo_unitario: string;
  quantidade_estoque: string;
  ativo: boolean;
}

const FORM_VAZIO: FormIngrediente = {
  nome: "",
  tipo: "POLPA",
  unidade_medida: "KG",
  custo_unitario: "",
  quantidade_estoque: "",
  ativo: true,
};

const virgula = (n: number) => String(n).replace(".", ",");

export default function Ingredientes() {
  const { getIngredientes, criarIngrediente, atualizarIngrediente, excluirIngrediente } = useFetchData();
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [editando, setEditando] = useState<Ingrediente | null>(null);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<FormIngrediente>(FORM_VAZIO);
  const [corrigirCusto, setCorrigirCusto] = useState(false);

  const carregar = useCallback(async () => {
    const resp = await getIngredientes();
    if (resp.ok) setIngredientes(resp.data);
  }, [getIngredientes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrir(ingrediente: Ingrediente | null) {
    setEditando(ingrediente);
    setForm(
      ingrediente
        ? {
            nome: ingrediente.nome,
            tipo: ingrediente.tipo,
            unidade_medida: ingrediente.unidade_medida,
            custo_unitario: virgula(ingrediente.custo_unitario ?? 0),
            quantidade_estoque: virgula(ingrediente.quantidade_estoque),
            ativo: ingrediente.ativo,
          }
        : FORM_VAZIO,
    );
    setCorrigirCusto(false);
    setAberto(true);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const dados: Partial<Ingrediente> = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      unidade_medida: form.unidade_medida,
      ativo: form.ativo,
    };
    // Na edição o custo só muda se o admin marcar "corrigir custo"; o normal é a compra atualizar a média
    if (!editando || corrigirCusto) {
      const custo = lerNumero(form.custo_unitario);
      if (!Number.isNaN(custo) && custo !== editando?.custo_unitario) dados.custo_unitario = custo;
    }
    if (editando && lerNumero(form.quantidade_estoque) !== editando.quantidade_estoque) {
      dados.quantidade_estoque = lerNumero(form.quantidade_estoque);
    }

    const resp = editando ? await atualizarIngrediente(editando.id, dados) : await criarIngrediente(dados);
    if (resp.ok) {
      toast.success(editando ? "Ingrediente atualizado." : "Ingrediente cadastrado.");
      setAberto(false);
      carregar();
    } else toast.error(mensagemErro(resp.data));
  }

  async function apagar() {
    if (!editando) return;
    if (!window.confirm(`Apagar ${editando.nome}? Isso não pode ser desfeito.`)) return;
    const resp = await excluirIngrediente(editando.id);
    if (resp.ok) {
      toast.success("Ingrediente apagado.");
      setAberto(false);
      carregar();
    } else toast.error(mensagemErro(resp.data));
  }

  const set = <K extends keyof FormIngrediente>(campo: K, valor: FormIngrediente[K]) =>
    setForm({ ...form, [campo]: valor });

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Ingredientes</h1>
          <p>
            Polpas, açúcar e garrafas usados na produção. Comprou mais caro? Registre a compra em Estoque: o custo vira
            a média do que está no estoque.
          </p>
        </div>
        <button className="btn btn-primario" onClick={() => abrir(null)}>
          <Plus size={18} /> Novo ingrediente
        </button>
      </div>

      <div className="card">
        <div className="tabela-wrapper">
          <table className="tabela tabela-cartoes">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nome</th>
                <th className="num">Custo médio</th>
                <th className="num">Em estoque</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ingredientes.map((i) => (
                <tr key={i.id} className={i.ativo ? "" : "inativo"}>
                  <td data-rotulo="Tipo">{NOMES_TIPO_INGREDIENTE[i.tipo]}</td>
                  <td className="principal">
                    <strong>{i.nome}</strong>
                  </td>
                  <td className="num" data-rotulo="Custo médio">
                    <div>
                      {moeda(i.custo_unitario ?? 0)}/{NOMES_UNIDADE[i.unidade_medida]}
                      {i.ultimo_custo_compra != null && i.ultima_compra_em && (
                        <div className="texto-suave">
                          última compra {moeda(i.ultimo_custo_compra)}/{NOMES_UNIDADE[i.unidade_medida]} em{" "}
                          {data(i.ultima_compra_em)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="num" data-rotulo="Em estoque">
                    {numero(i.quantidade_estoque)} {NOMES_UNIDADE[i.unidade_medida]}
                  </td>
                  <td className="num acao">
                    <button className="btn btn-pequeno" onClick={() => abrir(i)} aria-label="Editar">
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
        titulo={editando ? `Editar ${editando.nome}` : "Novo ingrediente"}
        aberto={aberto}
        onFechar={() => setAberto(false)}
      >
        <form onSubmit={salvar}>
          <div className="form-grid">
            <label className="campo" style={{ gridColumn: "1 / -1" }}>
              Nome
              <input
                required
                placeholder="Ex.: Polpa de Cupuaçu"
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
              />
            </label>
            <label className="campo">
              Tipo
              <select value={form.tipo} onChange={(e) => set("tipo", e.target.value as TipoIngrediente)}>
                {Object.entries(NOMES_TIPO_INGREDIENTE).map(([valor, nome]) => (
                  <option key={valor} value={valor}>
                    {nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              Unidade
              <select
                value={form.unidade_medida}
                onChange={(e) => set("unidade_medida", e.target.value as UnidadeMedida)}
              >
                {Object.entries(NOMES_UNIDADE).map(([valor, nome]) => (
                  <option key={valor} value={valor}>
                    {nome}
                  </option>
                ))}
              </select>
            </label>
            {(!editando || corrigirCusto) && (
              <label className="campo">
                {editando ? "Custo médio corrigido" : "Custo"} por {NOMES_UNIDADE[form.unidade_medida]} (R$)
                <input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={form.custo_unitario}
                  onChange={(e) => set("custo_unitario", e.target.value)}
                />
              </label>
            )}
            {editando && (
              <label className="campo">
                Estoque (ajuste manual)
                <input
                  inputMode="decimal"
                  value={form.quantidade_estoque}
                  onChange={(e) => set("quantidade_estoque", e.target.value)}
                />
              </label>
            )}
            <label className="campo-check">
              <input type="checkbox" checked={form.ativo} onChange={(e) => set("ativo", e.target.checked)} />
              Ativo
            </label>
          </div>
          {editando && (
            <label className="campo-check" style={{ marginTop: "0.8rem" }}>
              <input type="checkbox" checked={corrigirCusto} onChange={(e) => setCorrigirCusto(e.target.checked)} />
              Corrigir custo manualmente
            </label>
          )}
          <p className="texto-suave" style={{ marginTop: "0.8rem" }}>
            O custo muda sozinho quando uma compra é registrada em Estoque › Registrar compra (média ponderada). Ex.: 2
            kg a R$ 13 + 3 kg a R$ 15 = R$ 14,20/kg. Não edite o preço aqui quando comprar mais caro.
          </p>
          <div className="form-acoes">
            {editando && (
              <button type="button" className="btn btn-perigo" onClick={apagar} style={{ marginRight: "auto" }}>
                <Trash size={16} /> Apagar
              </button>
            )}
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
