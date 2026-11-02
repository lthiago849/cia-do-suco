import { useEffect, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";

import { useFetchData } from "../../Hooks/FetchData/useFetchData";
import { Cliente } from "../../Interfaces";
import { moeda, telefone } from "../../Utils/formatar";
import style from "./BuscaCliente.module.css";

interface BuscaClienteProps {
  selecionado: Cliente | null;
  onSelecionar: (cliente: Cliente | null) => void;
  /** Texto para já começar buscando (ex.: nome lido da mensagem do cliente) */
  buscaInicial?: string;
}

/** Campo de busca de cliente por nome ou telefone, com lista de sugestões */
export default function BuscaCliente({ selecionado, onSelecionar, buscaInicial = "" }: BuscaClienteProps) {
  const { getClientes } = useFetchData();
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Cliente[]>([]);

  useEffect(() => {
    if (buscaInicial) setBusca(buscaInicial);
  }, [buscaInicial]);

  useEffect(() => {
    if (busca.trim().length < 2) {
      setResultados([]);
      return;
    }
    const timer = setTimeout(() => {
      getClientes(busca.trim()).then((resp) => resp.ok && setResultados(resp.data.slice(0, 8)));
    }, 250);
    return () => clearTimeout(timer);
  }, [busca, getClientes]);

  if (selecionado) {
    return (
      <div className={style.selecionado}>
        <div>
          <strong>{selecionado.nome}</strong>
          <span className="texto-suave">
            {telefone(selecionado.telefone)}
            {selecionado.saldo_fiado > 0 && (
              <span className="texto-perigo"> · deve {moeda(selecionado.saldo_fiado)}</span>
            )}
          </span>
        </div>
        <button className="btn btn-pequeno" onClick={() => onSelecionar(null)} aria-label="Trocar cliente">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className={style.container}>
      <div className={style.campo}>
        <MagnifyingGlass size={18} />
        <input
          className="input"
          placeholder="Buscar cliente por nome ou telefone"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      {resultados.length > 0 && (
        <ul className={style.lista}>
          {resultados.map((cliente) => (
            <li key={cliente.id}>
              <button
                onClick={() => {
                  onSelecionar(cliente);
                  setBusca("");
                }}
              >
                <strong>{cliente.nome}</strong>
                <span className="texto-suave">{telefone(cliente.telefone)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
