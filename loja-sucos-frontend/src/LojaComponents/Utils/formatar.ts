import { CategoriaProduto, Endereco, FormaPagamento, TipoIngrediente, UnidadeMedida } from "../Interfaces";

const FUSO_LOJA = "America/Sao_Paulo";

export const NOMES_CATEGORIA: Record<CategoriaProduto, string> = {
  SUCO: "Sucos",
  PICOLE: "Picolés",
  MORENINHA: "Moreninhas",
  CREMOSINHO: "Cremosinhos",
};

export const NOMES_FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  FIADO: "Fiado",
};

export const NOMES_TIPO_INGREDIENTE: Record<TipoIngrediente, string> = {
  POLPA: "Polpa",
  FRUTA: "Fruta",
  ACUCAR: "Açúcar",
  GARRAFA: "Garrafa",
  OUTRO: "Outro",
};

export const NOMES_UNIDADE: Record<UnidadeMedida, string> = {
  KG: "kg",
  L: "L",
  UN: "un",
};

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function moeda(valor: number): string {
  return formatoMoeda.format(valor);
}

export function numero(valor: number, casas = 3): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: casas });
}

export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: FUSO_LOJA,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function data(iso: string): string {
  // Datas puras (AAAA-MM-DD) não têm fuso; datas com horário são convertidas para o fuso da loja
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO_LOJA });
}

/** Data de hoje no fuso da loja, no formato AAAA-MM-DD (o mesmo do <input type="date">) */
export function hojeISO(deslocamentoDias = 0): string {
  const dia = new Date(Date.now() + deslocamentoDias * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_LOJA }).format(dia);
}

export function telefone(digitos: string | null): string {
  if (!digitos) return "";
  const m = digitos.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : digitos;
}

export function linkWhatsApp(digitos: string): string {
  return `https://wa.me/${digitos}`;
}

export function textoEndereco(endereco: Endereco): string {
  const partes = [
    [endereco.logradouro, endereco.numero].filter(Boolean).join(", "),
    endereco.complemento,
    endereco.bairro,
  ].filter(Boolean);
  return partes.join(" — ");
}

export function linkMapa(endereco: Endereco): string | null {
  if (endereco.latitude !== null && endereco.longitude !== null) {
    return `https://www.google.com/maps?q=${endereco.latitude},${endereco.longitude}`;
  }
  const texto = textoEndereco(endereco);
  return texto ? `https://www.google.com/maps/search/${encodeURIComponent(texto)}` : null;
}

/** Converte "12,50", "1.234,50" ou "12.50" em número; vazio vira NaN */
export function lerNumero(texto: string): number {
  const limpo = texto.trim();
  if (limpo === "") return NaN;
  return Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo);
}
