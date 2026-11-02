import { ReactNode, useEffect } from "react";
import { X } from "@phosphor-icons/react";

import style from "./Modal.module.css";

interface ModalProps {
  titulo: string;
  aberto: boolean;
  onFechar: () => void;
  children: ReactNode;
  largura?: number;
}

export default function Modal({ titulo, aberto, onFechar, children, largura = 520 }: ModalProps) {
  useEffect(() => {
    if (!aberto) return;
    const fecharComEsc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", fecharComEsc);
    return () => window.removeEventListener("keydown", fecharComEsc);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div className={style.fundo} onMouseDown={onFechar}>
      <div
        className={style.janela}
        style={{ maxWidth: largura }}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={style.topo}>
          <h2>{titulo}</h2>
          <button className="btn btn-pequeno" onClick={onFechar} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
