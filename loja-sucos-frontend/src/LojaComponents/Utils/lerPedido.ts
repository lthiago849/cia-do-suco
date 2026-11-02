import { CategoriaProduto, FormaPagamento, Produto } from "../Interfaces";

/** O que deu para entender de uma mensagem do cliente ("2 de acerola e 1 cupuaçu, pix"). O atendente sempre confere. */
export interface PedidoLido {
  itens: { produto_id: string; quantidade: number }[];
  forma_pagamento: FormaPagamento | null;
  observacao: string | null;
  nome_cliente: string | null;
  telefone: string | null;
  /** Trechos que falam de suco/picolé mas não bateram com nenhum produto ativo */
  nao_reconhecidos: string[];
}

const NUMEROS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, duzia: 12,
};

const PALAVRAS_CATEGORIA: Record<CategoriaProduto, string[]> = {
  SUCO: ["suco", "sucos"],
  PICOLE: ["picole", "picoles"],
  MORENINHA: ["moreninha", "moreninhas"],
  CREMOSINHO: ["cremosinho", "cremosinhos"],
};

const NUMERO = `(\\d{1,3}|${Object.keys(NUMEROS).join("|")})`;

/** Minúsculas e sem acento, para comparar "Cupuaçu" com "cupuacu" */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function valorNumero(token: string): number {
  return /^\d+$/.test(token) ? Number(token) : NUMEROS[token];
}

/** Regex do nome do produto aceitando plural ("acerolas", "limões") e "c/" no lugar de "com" */
function regexProduto(nome: string): RegExp {
  const palavras = normalizar(nome).split(/\s+/).filter(Boolean);
  const partes = palavras.map((palavra, i) => {
    if (palavra === "com") return "(?:com|c/)";
    const escapada = palavra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (i < palavras.length - 1) return escapada;
    if (escapada.endsWith("ao")) return `${escapada.slice(0, -2)}(?:ao|oes)`;
    return `${escapada}(?:s|es)?`;
  });
  return new RegExp(`\\b${partes.join("\\s+")}\\b`);
}

function categoriaCitada(trecho: string): CategoriaProduto | null {
  for (const [categoria, palavras] of Object.entries(PALAVRAS_CATEGORIA)) {
    if (palavras.some((p) => new RegExp(`\\b${p}\\b`).test(trecho))) return categoria as CategoriaProduto;
  }
  return null;
}

/** Quantidade escrita logo antes ("2 de acerola", "duas acerolas") ou logo depois ("acerola 2", "acerola x2") */
function quantidadeDoItem(antes: string, depois: string): number {
  const anterior = antes.match(new RegExp(`\\b${NUMERO}\\b(?!.*\\b${NUMERO}\\b)`));
  if (anterior) return valorNumero(anterior[1]);
  const posterior = depois.match(new RegExp(`^\\s*(?:x\\s*)?${NUMERO}\\b`));
  return posterior ? valorNumero(posterior[1]) : 1;
}

function formaPagamento(texto: string): FormaPagamento | null {
  const encontradas = new Set<FormaPagamento>();
  if (/\bpix\b/.test(texto)) encontradas.add("PIX");
  if (/\b(dinheiro|especie)\b/.test(texto)) encontradas.add("DINHEIRO");
  if (/\bdebito\b/.test(texto)) encontradas.add("DEBITO");
  if (/\bcredito\b/.test(texto)) encontradas.add("CREDITO");
  // Cliente indeciso ("pix ou dinheiro") fica para o atendente decidir
  return encontradas.size === 1 ? [...encontradas][0] : null;
}

function observacao(texto: string): string | null {
  const notas: string[] = [];
  const troco = texto.match(/\btroco\s*(?:p\/|para|pra|de)?\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/);
  if (troco) notas.push(`Troco para R$ ${troco[1]}`);
  if (/\bcartao\b/.test(texto) && !/\b(debito|credito)\b/.test(texto)) notas.push("Cartão (débito ou crédito?)");
  return notas.length ? notas.join(" · ") : null;
}

function nomeCliente(original: string): string | null {
  const achado = original.match(
    /(?:meu nome [eé]|nome\s*:|aqui [eé] (?:[oa] )?|sou (?:[oa] )?)\s*([A-Za-zÀ-ÿ]{2,}(?:\s+[A-Za-zÀ-ÿ]{2,})?)/i,
  );
  return achado ? achado[1].trim() : null;
}

function telefoneCliente(original: string): string | null {
  const achado = original.match(/(?:\+?55\s*)?\(?\d{2}\)?\s*9\s*\d{4}[-\s]?\d{4}/);
  return achado ? achado[0].replace(/\D/g, "") : null;
}

export function lerPedido(mensagem: string, produtos: Produto[]): PedidoLido {
  const texto = normalizar(mensagem);
  const ativos = [...produtos]
    .filter((p) => p.ativo)
    // Nomes mais longos primeiro: "Laranja com Beterraba" antes de "Laranja"
    .sort((a, b) => b.nome.length - a.nome.length)
    .map((p) => ({ produto: p, regex: regexProduto(p.nome) }));

  const quantidades = new Map<string, number>();
  const naoReconhecidos: string[] = [];
  // "picolé de morango e chocolate": o "chocolate" herda a categoria do trecho anterior
  let ultimaCategoria: CategoriaProduto | null = null;

  const trechos = texto.split(/\n|,|;|\+|\s+e\s+/).map((t) => t.trim()).filter(Boolean);
  for (const trecho of trechos) {
    if (/\btroco\b/.test(trecho)) continue;
    const citada = categoriaCitada(trecho);
    const categoria = citada ?? ultimaCategoria;

    const tentar = (filtro: (p: Produto) => boolean) => {
      const achados: { produto: Produto; inicio: number; fim: number }[] = [];
      let restante = trecho;
      for (const { produto, regex } of ativos.filter((a) => filtro(a.produto))) {
        const m = restante.match(regex);
        if (!m || m.index === undefined) continue;
        achados.push({ produto, inicio: m.index, fim: m.index + m[0].length });
        // Apaga o trecho achado para "laranja" não bater de novo dentro de "laranja com beterraba"
        restante = restante.slice(0, m.index) + " ".repeat(m[0].length) + restante.slice(m.index + m[0].length);
      }
      return achados.sort((a, b) => a.inicio - b.inicio);
    };

    let achados = citada ? tentar((p) => p.categoria === citada) : tentar((p) => p.categoria === "SUCO");
    if (!achados.length && !citada && categoria && categoria !== "SUCO") achados = tentar((p) => p.categoria === categoria);
    if (!achados.length && !citada) {
      // Sabor de gelado sem dizer o tipo ("milho verde"): só vale se não houver dúvida
      const gelados = tentar((p) => p.categoria !== "SUCO");
      if (gelados.length === 1) achados = gelados;
    }

    if (!achados.length) {
      if (citada) naoReconhecidos.push(trecho);
      continue;
    }

    achados.forEach((achado, i) => {
      const antes = trecho.slice(i === 0 ? 0 : achados[i - 1].fim, achado.inicio);
      const depois = trecho.slice(achado.fim, i + 1 < achados.length ? achados[i + 1].inicio : undefined);
      const id = achado.produto.id;
      quantidades.set(id, (quantidades.get(id) ?? 0) + quantidadeDoItem(antes, depois));
    });
    ultimaCategoria = achados[achados.length - 1].produto.categoria;
  }

  return {
    itens: [...quantidades].map(([produto_id, quantidade]) => ({ produto_id, quantidade })),
    forma_pagamento: formaPagamento(texto),
    observacao: observacao(texto),
    nome_cliente: nomeCliente(mensagem),
    telefone: telefoneCliente(mensagem),
    nao_reconhecidos: naoReconhecidos,
  };
}
