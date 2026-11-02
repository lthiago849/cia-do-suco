/** Texto copiado no WhatsApp. Vazio se o navegador não deixar ler (aí o atendente cola no campo). */
export async function lerAreaDeTransferencia(): Promise<string> {
  try {
    return (await navigator.clipboard.readText()).trim();
  } catch {
    return "";
  }
}

// Mensagem compartilhada do WhatsApp guardada até o atendente chegar na tela de Entregas
// (pode passar pelo login no meio do caminho)
const CHAVE = "mensagem_compartilhada";

export function guardarMensagemCompartilhada(texto: string) {
  try {
    sessionStorage.setItem(CHAVE, texto);
  } catch {
    // navegador sem storage: o atendente cola a mensagem na mão
  }
}

export function temMensagemCompartilhada(): boolean {
  try {
    return !!sessionStorage.getItem(CHAVE);
  } catch {
    return false;
  }
}

export function pegarMensagemCompartilhada(): string {
  try {
    const texto = sessionStorage.getItem(CHAVE) ?? "";
    sessionStorage.removeItem(CHAVE);
    return texto;
  } catch {
    return "";
  }
}
