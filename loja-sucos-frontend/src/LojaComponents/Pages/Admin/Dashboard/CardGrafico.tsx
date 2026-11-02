import { ReactNode, useState } from "react";

import style from "./Dashboard.module.css";

interface CardGraficoProps {
  titulo: string;
  descricao?: string;
  grafico: ReactNode;
  tabela: ReactNode;
  vazio?: boolean;
  className?: string;
}

/** Card com o gráfico e a mesma informação em tabela (para quem não lê bem as cores ou quer o número exato) */
export default function CardGrafico({ titulo, descricao, grafico, tabela, vazio, className }: CardGraficoProps) {
  const [verTabela, setVerTabela] = useState(false);

  return (
    <section className={`card ${style.cardGrafico} ${className ?? ""}`}>
      <div className={style.cardTopo}>
        <div>
          <h2>{titulo}</h2>
          {descricao && <p className="texto-suave">{descricao}</p>}
        </div>
        {!vazio && (
          <button className="btn btn-pequeno" onClick={() => setVerTabela(!verTabela)}>
            {verTabela ? "Ver gráfico" : "Ver tabela"}
          </button>
        )}
      </div>
      {vazio ? (
        <p className="vazio">Sem vendas no período.</p>
      ) : verTabela ? (
        <div className="tabela-wrapper">{tabela}</div>
      ) : (
        grafico
      )}
    </section>
  );
}
