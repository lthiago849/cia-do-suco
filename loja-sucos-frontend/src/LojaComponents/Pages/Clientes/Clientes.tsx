import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { UserPlus } from "@phosphor-icons/react";

import { mensagemErro, useFetchData } from "../../Hooks/FetchData/useFetchData";
import { Cliente } from "../../Interfaces";
import { moeda, telefone, textoEndereco } from "../../Utils/formatar";
import NovoClienteModal from "./NovoClienteModal";

export default function Clientes() {
  const { getClientes } = useFetchData();
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      getClientes(busca.trim()).then((resp) =>
        resp.ok ? setClientes(resp.data) : toast.error(mensagemErro(resp.data)),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [busca, getClientes]);

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Clientes</h1>
          <p>Cadastro, endereços de entrega e fiado.</p>
        </div>
        <button className="btn btn-primario" onClick={() => setNovo(true)} aria-label="Novo cliente">
          <UserPlus size={18} /> <span className="so-desktop">Novo cliente</span>
        </button>
      </div>

      <div className="card">
        <input
          className="input"
          placeholder="Buscar por nome ou telefone"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ marginBottom: "0.8rem" }}
        />
        {clientes.length === 0 ? (
          <p className="vazio">Nenhum cliente encontrado.</p>
        ) : (
          <div className="tabela-wrapper">
            <table className="tabela tabela-cartoes">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Endereço atual</th>
                  <th className="num">Fiado</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id} className="clicavel" onClick={() => navigate(`/clientes/${c.id}`)}>
                    <td className="principal">
                      <div>
                        <strong>{c.nome}</strong>
                        {c.observacao && <div className="texto-suave">{c.observacao}</div>}
                      </div>
                    </td>
                    <td data-rotulo="Telefone">{telefone(c.telefone)}</td>
                    <td data-rotulo="Endereço">
                      {c.endereco_atual ? (
                        <div>
                          {textoEndereco(c.endereco_atual)}
                          {c.endereco_atual.ponto_referencia && (
                            <div className="texto-suave">Ref.: {c.endereco_atual.ponto_referencia}</div>
                          )}
                        </div>
                      ) : (
                        <span className="badge badge-alerta">Sem endereço</span>
                      )}
                    </td>
                    <td className="num" data-rotulo="Fiado">
                      {c.saldo_fiado > 0 ? (
                        <span className="texto-perigo">{moeda(c.saldo_fiado)}</span>
                      ) : (
                        <span className="texto-suave">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NovoClienteModal aberto={novo} onFechar={() => setNovo(false)} onCriado={(c) => navigate(`/clientes/${c.id}`)} />
    </div>
  );
}
