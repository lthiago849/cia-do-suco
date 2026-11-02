import { Navigate, useSearchParams } from "react-router-dom";

import { guardarMensagemCompartilhada } from "../../Utils/compartilhar";

/** Destino do "Compartilhar" do celular (manifest.webmanifest → share_target): guarda o texto e abre um pedido novo */
export default function Compartilhar() {
  const [params] = useSearchParams();
  // Cada app manda o texto num campo diferente; o WhatsApp usa "text"
  const texto = ["title", "text", "url"]
    .map((campo) => params.get(campo)?.trim())
    .filter(Boolean)
    .join("\n");
  if (texto) guardarMensagemCompartilhada(texto);
  return <Navigate to="/entregas" replace />;
}
