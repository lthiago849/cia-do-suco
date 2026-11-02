import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useGlobalContext } from "../../GlobalContext";
import { mensagemErro, useFetchData } from "../../Hooks/FetchData/useFetchData";
import { Ingrediente, Producao as ProducaoModel, Produto } from "../../Interfaces";
import { NOMES_UNIDADE, dataHora, lerNumero, moeda, numero } from "../../Utils/formatar";
import SelecaoBusca from "../../PagesSections/SelecaoBusca/SelecaoBusca";

export default function Producao() {
  const { account } = useGlobalContext();
  const { getProdutos, getIngredientes, getProducoes, registrarProducao } = useFetchData();
  const ehAdmin = account.usuario?.tipo === "ADMIN";
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [producoes, setProducoes] = useState<ProducaoModel[]>([]);

  const [produtoId, setProdutoId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [polpa, setPolpa] = useState("");
  const [acucar, setAcucar] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    const [p, i, h] = await Promise.all([
      getProdutos({ ativo: true }),
      getIngredientes({ ativo: true }),
      getProducoes(),
    ]);
    // Só produtos com polpa cadastrada são produzidos na loja
    if (p.ok) setProdutos(p.data.filter((produto) => produto.ingrediente_id));
    if (i.ok) setIngredientes(i.data);
    if (h.ok) setProducoes(h.data);
  }, [getProdutos, getIngredientes, getProducoes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const produto = produtos.find((p) => p.id === produtoId);
  const polpaIngrediente = ingredientes.find((i) => i.id === produto?.ingrediente_id);
  const disponivel = (tipo: Ingrediente["tipo"]) =>
    ingredientes.filter((i) => i.tipo === tipo).reduce((s, i) => s + i.quantidade_estoque, 0);
  const acucarDisponivel = disponivel("ACUCAR");
  const garrafasDisponiveis = disponivel("GARRAFA");

  const opcoesSuco = produtos.map((p) => {
    const polpaDoSuco = ingredientes.find((i) => i.id === p.ingrediente_id);
    return {
      valor: p.id,
      rotulo: p.nome,
      detalhe: polpaDoSuco
        ? `${numero(polpaDoSuco.quantidade_estoque)} ${NOMES_UNIDADE[polpaDoSuco.unidade_medida]} de polpa`
        : undefined,
    };
  });

  const qtd = lerNumero(quantidade);
  const polpaUsada = lerNumero(polpa);
  const acucarUsado = lerNumero(acucar);
  const faltamGarrafas = qtd > garrafasDisponiveis;
  const valido =
    !!produto && Number.isInteger(qtd) && qtd > 0 && polpaUsada >= 0 && acucarUsado >= 0 && !faltamGarrafas;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const resp = await registrarProducao({
        produto_id: produtoId,
        quantidade_produzida: qtd,
        polpa_usada: polpaUsada,
        acucar_usado: acucarUsado,
      });
      if (resp.ok) {
        toast.success(`${resp.data.quantidade_produzida} × ${resp.data.produto_nome} adicionados ao estoque.`);
        setQuantidade("");
        setPolpa("");
        setAcucar("");
        carregar();
      } else toast.error(mensagemErro(resp.data));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Produção</h1>
          <p>Registre os sucos feitos. A polpa, o açúcar e uma garrafa PET por suco saem do estoque.</p>
        </div>
      </div>

      <form className="card" onSubmit={salvar}>
        <h2>Nova produção</h2>
        <div className="form-grid">
          <div className="campo">
            Suco
            <SelecaoBusca
              opcoes={opcoesSuco}
              valor={produtoId}
              onChange={setProdutoId}
              placeholder="Digite o sabor (ex.: cupuaçu)"
            />
          </div>
          <label className="campo">
            Quantidade produzida (un)
            <input inputMode="numeric" required value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </label>
          <label className="campo">
            {polpaIngrediente ? `${polpaIngrediente.nome} usada` : "Polpa usada"}
            {polpaIngrediente &&
              ` (tem ${numero(polpaIngrediente.quantidade_estoque)} ${NOMES_UNIDADE[polpaIngrediente.unidade_medida]})`}
            <input inputMode="decimal" required value={polpa} onChange={(e) => setPolpa(e.target.value)} />
          </label>
          <label className="campo">
            Açúcar usado (tem {numero(acucarDisponivel)} kg)
            <input inputMode="decimal" required value={acucar} onChange={(e) => setAcucar(e.target.value)} />
          </label>
        </div>
        <p className={faltamGarrafas ? "texto-perigo" : "texto-suave"} style={{ marginTop: "0.8rem" }}>
          {qtd > 0 ? `Vai usar ${qtd} garrafa${qtd === 1 ? "" : "s"} PET` : "Usa 1 garrafa PET por suco"} · em estoque:{" "}
          {numero(garrafasDisponiveis)}
          {faltamGarrafas && " — registre a compra de garrafas em Estoque antes de produzir."}
        </p>
        <div className="form-acoes">
          <button className="btn btn-primario" disabled={!valido || enviando}>
            Registrar produção
          </button>
        </div>
      </form>

      <div className="card">
        <h2>Últimas produções</h2>
        {producoes.length === 0 ? (
          <p className="vazio">Nenhuma produção registrada.</p>
        ) : (
          <div className="tabela-wrapper">
            <table className="tabela tabela-cartoes">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Suco</th>
                  <th className="num">Quantidade</th>
                  <th className="num">Polpa</th>
                  <th className="num">Açúcar</th>
                  <th className="num">Garrafas</th>
                  {ehAdmin && <th className="num">Custo</th>}
                  <th>Produzido por</th>
                </tr>
              </thead>
              <tbody>
                {producoes.map((p) => (
                  <tr key={p.id}>
                    <td data-rotulo="Quando">{dataHora(p.produzido_em)}</td>
                    <td className="principal">{p.produto_nome}</td>
                    <td className="num" data-rotulo="Quantidade">
                      {p.quantidade_produzida}
                    </td>
                    <td className="num" data-rotulo="Polpa">
                      {numero(p.polpa_usada)}
                    </td>
                    <td className="num" data-rotulo="Açúcar">
                      {numero(p.acucar_usado)} kg
                    </td>
                    <td className="num" data-rotulo="Garrafas">
                      {p.garrafas_usadas}
                    </td>
                    {ehAdmin && (
                      <td className="num" data-rotulo="Custo">
                        {moeda(p.custo_total ?? 0)}
                      </td>
                    )}
                    <td data-rotulo="Produzido por">{p.usuario_nome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
