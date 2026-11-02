import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { mensagemErro, useFetchData } from "../../../Hooks/FetchData/useFetchData";
import { TaxaPagamento } from "../../../Interfaces";
import { NOMES_FORMA_PAGAMENTO, data, lerNumero, moeda } from "../../../Utils/formatar";

const virgula = (n: number) => String(n).replace(".", ",");

interface Edicao {
  percentual: string;
  repassar: boolean;
}

/** Exemplo numa venda de R$ 10: quanto o cliente passa na máquina e quanto a loja paga de taxa */
function exemplo(percentual: number, repassar: boolean): string {
  const acrescimo = repassar ? Math.round(10 * percentual) / 100 : 0;
  const taxa = Math.round((10 + acrescimo) * percentual) / 100;
  return repassar
    ? `cliente passa ${moeda(10 + acrescimo)}; loja paga ${moeda(taxa - acrescimo)}`
    : `cliente passa ${moeda(10)}; loja paga ${moeda(taxa)}`;
}

export default function Taxas() {
  const { getTaxas, atualizarTaxa } = useFetchData();
  const [taxas, setTaxas] = useState<TaxaPagamento[]>([]);
  const [edicao, setEdicao] = useState<Record<string, Edicao>>({});

  const carregar = useCallback(async () => {
    const resp = await getTaxas();
    if (!resp.ok) return toast.error(mensagemErro(resp.data));
    setTaxas(resp.data);
    setEdicao(
      Object.fromEntries(
        resp.data.map((t) => [t.forma_pagamento, { percentual: virgula(t.percentual), repassar: t.repassar_cliente }]),
      ),
    );
  }, [getTaxas]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar(taxa: TaxaPagamento) {
    const atual = edicao[taxa.forma_pagamento];
    const percentual = lerNumero(atual.percentual);
    if (Number.isNaN(percentual) || percentual < 0 || percentual >= 100) {
      toast.warning("Informe um percentual entre 0 e 99,99.");
      return;
    }
    const resp = await atualizarTaxa(taxa.forma_pagamento, { percentual, repassar_cliente: atual.repassar });
    if (resp.ok) {
      toast.success(`Taxa do ${NOMES_FORMA_PAGAMENTO[taxa.forma_pagamento].toLowerCase()} atualizada.`);
      carregar();
    } else toast.error(mensagemErro(resp.data));
  }

  function editar(forma: string, mudanca: Partial<Edicao>) {
    setEdicao({ ...edicao, [forma]: { ...edicao[forma], ...mudanca } });
  }

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Taxas da maquininha</h1>
          <p>
            Percentual cobrado em cada forma de pagamento. Com "cobrar do cliente" ligado, o caixa mostra o valor com o
            acréscimo para passar na máquina. Vale para as vendas feitas a partir de agora.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="tabela-wrapper">
          <table className="tabela tabela-cartoes">
            <thead>
              <tr>
                <th>Forma de pagamento</th>
                <th>Taxa (%)</th>
                <th>Cobrar do cliente</th>
                <th>Numa venda de R$ 10,00</th>
                <th>Alterada em</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {taxas.map((t) => {
                const atual = edicao[t.forma_pagamento];
                if (!atual) return null;
                const digitado = lerNumero(atual.percentual);
                const alterado =
                  (!Number.isNaN(digitado) && digitado !== t.percentual) || atual.repassar !== t.repassar_cliente;
                return (
                  <tr key={t.forma_pagamento}>
                    <td className="principal">
                      <strong>{NOMES_FORMA_PAGAMENTO[t.forma_pagamento]}</strong>
                    </td>
                    <td data-rotulo="Taxa (%)">
                      <input
                        className="input"
                        style={{ maxWidth: 110 }}
                        inputMode="decimal"
                        value={atual.percentual}
                        onChange={(e) => editar(t.forma_pagamento, { percentual: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && salvar(t)}
                      />
                    </td>
                    <td data-rotulo="Cobrar do cliente">
                      <label className="campo-check">
                        <input
                          type="checkbox"
                          checked={atual.repassar}
                          onChange={(e) => editar(t.forma_pagamento, { repassar: e.target.checked })}
                        />
                        {atual.repassar ? "Sim" : "Não, a loja paga"}
                      </label>
                    </td>
                    <td className="texto-suave" data-rotulo="Venda de R$ 10,00">
                      {Number.isNaN(digitado) || digitado <= 0 ? "sem taxa" : exemplo(digitado, atual.repassar)}
                    </td>
                    <td className="texto-suave" data-rotulo="Alterada em">
                      {data(t.updated_at)}
                    </td>
                    <td className="num">
                      <button className="btn btn-pequeno btn-primario" disabled={!alterado} onClick={() => salvar(t)}>
                        Salvar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="texto-suave" style={{ marginTop: "0.8rem" }}>
          A maquininha cobra o percentual sobre o valor passado nela; por isso, mesmo cobrando do cliente, sobram alguns
          centavos de taxa para a loja. Fiado não tem taxa própria: quando o cliente paga o fiado no cartão, vale a
          regra do cartão usado.
        </p>
      </div>
    </div>
  );
}
