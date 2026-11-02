import { ReactNode, useEffect, useState } from "react";
import { CaretDown, CaretUp, SlidersHorizontal } from "@phosphor-icons/react";

const CONSULTA_CELULAR = "(max-width: 600px)";

/** true quando a tela tem largura de celular (acompanha a rotação/redimensionamento) */
export function useEhCelular(): boolean {
  const [ehCelular, setEhCelular] = useState(() => window.matchMedia(CONSULTA_CELULAR).matches);

  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_CELULAR);
    const atualizar = () => setEhCelular(consulta.matches);
    consulta.addEventListener("change", atualizar);
    return () => consulta.removeEventListener("change", atualizar);
  }, []);

  return ehCelular;
}

interface RecolhivelProps {
  rotulo: string;
  /** Destaca o botão quando há algum filtro diferente do padrão escondido */
  destaque?: boolean;
  children: ReactNode;
}

/** No computador mostra os filtros direto; no celular eles ficam escondidos atrás de um botão */
export default function Recolhivel({ rotulo, destaque = false, children }: RecolhivelProps) {
  const ehCelular = useEhCelular();
  const [aberto, setAberto] = useState(false);

  if (!ehCelular) return <div className="recolhivel-conteudo">{children}</div>;

  return (
    <>
      <button
        type="button"
        className={`btn btn-pequeno ${destaque ? "btn-primario" : ""}`}
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
      >
        <SlidersHorizontal size={16} /> {rotulo} {aberto ? <CaretUp size={14} /> : <CaretDown size={14} />}
      </button>
      {aberto && <div className="recolhivel-conteudo">{children}</div>}
    </>
  );
}
