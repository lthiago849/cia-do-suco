import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { mensagemErro, useFetchData } from "../../Hooks/FetchData/useFetchData";
import { Devedor } from "../../Interfaces";
import { data, moeda, telefone } from "../../Utils/formatar";

export default function Fiado() {
  const { getDevedores } = useFetchData();
  const navigate = useNavigate();
  const [devedores, setDevedores] = useState<Devedor[]>([]);

  useEffect(() => {
    getDevedores().then((resp) => (resp.ok ? setDevedores(resp.data) : toast.error(mensagemErro(resp.data))));
  }, [getDevedores]);

  const total = devedores.reduce((soma, d) => soma + d.saldo, 0);

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Fiado</h1>
          <p>Quem está devendo. Clique no cliente para ver o que comprou e registrar pagamentos.</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="texto-suave">A receber</div>
          <strong className="texto-perigo" style={{ fontSize: "1.25rem", whiteSpace: "nowrap" }}>
            {moeda(total)}
          </strong>
        </div>
      </div>

      <div className="card">
        {devedores.length === 0 ? (
          <p className="vazio">Ninguém está devendo. 🎉</p>
        ) : (
          <div className="tabela-wrapper">
            <table className="tabela tabela-cartoes">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th className="num">Compras em aberto</th>
                  <th>Deve desde</th>
                  <th className="num">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {devedores.map((d) => (
                  <tr key={d.cliente_id} className="clicavel" onClick={() => navigate(`/clientes/${d.cliente_id}`)}>
                    <td className="principal">
                      <strong>{d.nome}</strong>
                    </td>
                    <td data-rotulo="Telefone">{telefone(d.telefone)}</td>
                    <td className="num" data-rotulo="Compras em aberto">
                      {d.vendas_em_aberto}
                    </td>
                    <td data-rotulo="Deve desde">
                      <span>
                        {data(d.divida_desde)}{" "}
                        <span
                          className={`badge ${d.dias_em_aberto > 30 ? "badge-perigo" : d.dias_em_aberto > 7 ? "badge-alerta" : ""}`}
                        >
                          {d.dias_em_aberto === 0
                            ? "hoje"
                            : `${d.dias_em_aberto} dia${d.dias_em_aberto === 1 ? "" : "s"}`}
                        </span>
                      </span>
                    </td>
                    <td className="num texto-perigo" data-rotulo="Saldo">
                      <strong>{moeda(d.saldo)}</strong>
                    </td>
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
