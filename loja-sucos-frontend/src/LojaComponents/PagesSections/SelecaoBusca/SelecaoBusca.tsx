import { KeyboardEvent, useEffect, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";

import style from "./SelecaoBusca.module.css";

export interface OpcaoBusca {
  valor: string;
  rotulo: string;
  /** Texto menor à direita (ex.: quanto tem em estoque) */
  detalhe?: string;
  /** Título de seção na lista (ex.: "Ingredientes", "Produtos prontos"); opções do mesmo grupo devem vir juntas */
  grupo?: string;
}

interface SelecaoBuscaProps {
  opcoes: OpcaoBusca[];
  valor: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/** Ignora acentos e maiúsculas: "acai" encontra "Açaí" */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Select em que dá para digitar e filtrar as opções. Pensado para listas grandes no celular. */
export default function SelecaoBusca({
  opcoes,
  valor,
  onChange,
  placeholder = "Digite para buscar...",
  autoFocus = false,
}: SelecaoBuscaProps) {
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState(false);
  const [destaque, setDestaque] = useState(0);

  const selecionada = opcoes.find((o) => o.valor === valor);
  const termo = normalizar(busca);
  const filtradas = termo ? opcoes.filter((o) => normalizar(o.rotulo).includes(termo)) : opcoes;

  useEffect(() => setDestaque(0), [busca]);

  function escolher(opcao: OpcaoBusca) {
    onChange(opcao.valor);
    setBusca("");
    setAberta(false);
  }

  function teclas(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAberta(true);
      setDestaque((d) => Math.min(d + 1, filtradas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDestaque((d) => Math.max(d - 1, 0));
    } else if (e.key === "Enter" && aberta && filtradas[destaque]) {
      // Enter escolhe a opção destacada em vez de enviar o formulário
      e.preventDefault();
      escolher(filtradas[destaque]);
    } else if (e.key === "Escape") {
      setAberta(false);
    }
  }

  if (selecionada) {
    return (
      <div className={style.selecionada}>
        <span>
          <strong>{selecionada.rotulo}</strong>
          {selecionada.detalhe && <span className="texto-suave"> · {selecionada.detalhe}</span>}
        </span>
        <button type="button" className="btn btn-pequeno" onClick={() => onChange("")} aria-label="Trocar">
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
          role="combobox"
          aria-expanded={aberta}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setAberta(true);
          }}
          onFocus={() => setAberta(true)}
          onBlur={() => setAberta(false)}
          onKeyDown={teclas}
        />
      </div>
      {aberta && (
        <ul className={style.lista} role="listbox">
          {filtradas.length === 0 ? (
            <li className={style.nada}>Nada encontrado.</li>
          ) : (
            filtradas.map((opcao, i) => (
              <li key={opcao.valor}>
                {opcao.grupo && opcao.grupo !== filtradas[i - 1]?.grupo && (
                  <div className={style.grupo}>{opcao.grupo}</div>
                )}
                <button
                  type="button"
                  className={i === destaque ? style.destacada : ""}
                  // onMouseDown (antes do blur do input) para o clique não se perder ao fechar a lista
                  onMouseDown={(e) => {
                    e.preventDefault();
                    escolher(opcao);
                  }}
                >
                  <span>{opcao.rotulo}</span>
                  {opcao.detalhe && <span className="texto-suave">{opcao.detalhe}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
