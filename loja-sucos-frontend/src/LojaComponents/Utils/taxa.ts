import { FormaPagamento, TaxaPagamento } from "../Interfaces";

/** Acréscimo que o cliente paga para cobrir a taxa do cartão (o servidor recalcula ao registrar) */
export function acrescimoCartao(valor: number, forma: FormaPagamento | "" | null, taxas: TaxaPagamento[]): number {
  const taxa = taxas.find((t) => t.forma_pagamento === forma);
  if (!taxa || !taxa.repassar_cliente || taxa.percentual <= 0) return 0;
  return Math.round(valor * taxa.percentual) / 100;
}

export function percentualTexto(forma: FormaPagamento | "" | null, taxas: TaxaPagamento[]): string {
  const taxa = taxas.find((t) => t.forma_pagamento === forma);
  return taxa ? `${String(taxa.percentual).replace(".", ",")}%` : "";
}
