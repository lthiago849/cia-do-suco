import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Prohibit } from "@phosphor-icons/react";

import { useGlobalContext } from "../../GlobalContext";
import { mensagemErro, useFetchData } from "../../Hooks/FetchData/useFetchData";
import { FormaPagamento, Periodo, Venda } from "../../Interfaces";
import { NOMES_FORMA_PAGAMENTO, dataHora, hojeISO, moeda } from "../../Utils/formatar";
import SeletorPeriodo from "../../PagesSections/SeletorPeriodo/SeletorPeriodo";
import CancelarVendaModal from "./CancelarVendaModal";

export default function Vendas() {
  const { account } = useGlobalContext();
  const { getVendas } = useFetchData();
  const [periodo, setPeriodo] = useState<Periodo>({ data_inicio: hojeISO(), data_fim: hojeISO() });
  const [forma, setForma] = useState<FormaPagamento | "">("");
  const [mostrarCanceladas, setMostrarCanceladas] = useState(false);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [cancelando, setCancelando] = useState<Venda | null>(null);

  const ehAdmin = account.usuario?.tipo === "ADMIN";

  const carregar = useCallback(async () => {
    const resp = await getVendas({
      ...periodo,
      forma_pagamento: forma || undefined,
      incluir_canceladas: mostrarCanceladas,
    });
    if (resp.ok) setVendas(resp.data);
    else toast.error(mensagemErro(resp.data));
  }, [getVendas, periodo, forma, mostrarCanceladas]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const validas = vendas.filter((v) => !v.cancelada_em);
  // O que entrou no caixa: produtos + entrega + acréscimo do cartão
  const cobrado = (v: Venda) => v.valor_total + v.taxa_entrega + v.acrescimo_pagamento;
  const total = validas.reduce((soma, v) => soma + cobrado(v), 0);

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Vendas</h1>
          <p className="manter-celular">
            {validas.length} venda{validas.length === 1 ? "" : "s"} · {moeda(total)}
          </p>
        </div>
      </div>

      <div className="card filtros">
        <SeletorPeriodo periodo={periodo} onChange={setPeriodo} filtrosAtivos={!!forma || mostrarCanceladas}>
          <label className="campo">
            Pagamento
            <select value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento | "")}>
              <option value="">Todos</option>
              {Object.entries(NOMES_FORMA_PAGAMENTO).map(([valor, nome]) => (
                <option key={valor} value={valor}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
          <label className="campo-check">
            <input
              type="checkbox"
              checked={mostrarCanceladas}
              onChange={(e) => setMostrarCanceladas(e.target.checked)}
            />
            Mostrar canceladas
          </label>
        </SeletorPeriodo>
      </div>

      <div className="card">
        {vendas.length === 0 ? (
          <p className="vazio">Nenhuma venda no período.</p>
        ) : (
          <div className="tabela-wrapper">
            <table className="tabela tabela-cartoes">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Produtos</th>
                  <th>Pagamento</th>
                  <th>Vendedor</th>
                  <th className="num">Total</th>
                  {ehAdmin && <th className="num">Lucro</th>}
                  {ehAdmin && <th />}
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => (
                  <tr key={v.id} className={v.cancelada_em ? "inativo" : ""}>
                    <td data-rotulo="Quando">{dataHora(v.data_venda)}</td>
                    <td className={ehAdmin ? "principal acao-larga" : "principal"}>
                      <div>
                        {v.itens.map((i) => `${i.quantidade}× ${i.produto_nome}`).join(", ")}
                        {v.observacao && <div className="texto-suave">{v.observacao}</div>}
                        {v.cancelada_em && (
                          <div className="texto-perigo motivo-cancelamento">
                            Cancelada em {dataHora(v.cancelada_em)}
                            {v.cancelada_por_nome ? ` por ${v.cancelada_por_nome}` : ""}
                            {v.motivo_cancelamento ? `: ${v.motivo_cancelamento}` : ""}
                          </div>
                        )}
                      </div>
                    </td>
                    <td data-rotulo="Pagamento">
                      <div>
                        <span className="badge">{NOMES_FORMA_PAGAMENTO[v.forma_pagamento]}</span>
                        {v.cliente_id && (
                          <div>
                            <Link to={`/clientes/${v.cliente_id}`}>{v.cliente_nome}</Link>
                          </div>
                        )}
                      </div>
                    </td>
                    <td data-rotulo="Vendedor">{v.usuario_nome}</td>
                    <td className="num" data-rotulo="Total">
                      <div>
                        {moeda(cobrado(v))}
                        {v.taxa_entrega > 0 && (
                          <div className="texto-suave">inclui {moeda(v.taxa_entrega)} de entrega</div>
                        )}
                        {v.acrescimo_pagamento > 0 && (
                          <div className="texto-suave">inclui {moeda(v.acrescimo_pagamento)} do cartão</div>
                        )}
                      </div>
                    </td>
                    {ehAdmin && (
                      <td className="num" data-rotulo="Lucro">
                        <div>
                          {moeda(
                            v.valor_total + v.acrescimo_pagamento - (v.custo_total ?? 0) - (v.taxa_pagamento ?? 0),
                          )}
                          {!!v.taxa_pagamento && <div className="texto-suave">taxa {moeda(v.taxa_pagamento)}</div>}
                        </div>
                      </td>
                    )}
                    {ehAdmin && (
                      <td className="num acao">
                        {v.cancelada_em ? (
                          <span className="badge badge-perigo">Cancelada</span>
                        ) : (
                          <button
                            className="btn btn-pequeno btn-perigo"
                            onClick={() => setCancelando(v)}
                            title="Cancelar venda"
                          >
                            <Prohibit size={16} />
                            Cancelar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CancelarVendaModal
        venda={cancelando}
        onFechar={() => setCancelando(null)}
        onCancelada={() => {
          setCancelando(null);
          carregar();
        }}
      />
    </div>
  );
}
