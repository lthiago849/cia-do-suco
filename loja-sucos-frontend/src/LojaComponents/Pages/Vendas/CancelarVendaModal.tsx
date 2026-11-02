import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { mensagemErro, useFetchData } from "../../Hooks/FetchData/useFetchData";
import { Venda } from "../../Interfaces";
import { dataHora, moeda } from "../../Utils/formatar";
import Modal from "../../PagesSections/Modal/Modal";

interface Props {
  venda: Venda | null;
  onFechar: () => void;
  onCancelada: () => void;
}

export default function CancelarVendaModal({ venda, onFechar, onCancelada }: Props) {
  const { cancelarVenda } = useFetchData();
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (venda) setMotivo("");
  }, [venda]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!venda) return;
    setSalvando(true);
    const resp = await cancelarVenda(venda.id, motivo.trim());
    setSalvando(false);
    if (resp.ok) {
      toast.success("Venda cancelada e estoque devolvido.");
      onCancelada();
    } else toast.error(mensagemErro(resp.data));
  }

  const cobrado = venda ? venda.valor_total + venda.taxa_entrega + venda.acrescimo_pagamento : 0;

  return (
    <Modal titulo="Cancelar venda" aberto={!!venda} onFechar={onFechar} largura={460}>
      {venda && (
        <form onSubmit={salvar}>
          <p>
            <strong>{venda.itens.map((i) => `${i.quantidade}× ${i.produto_nome}`).join(", ")}</strong>
          </p>
          <p className="texto-suave" style={{ marginBottom: "0.9rem" }}>
            {dataHora(venda.data_venda)} · {moeda(cobrado)} · vendida por {venda.usuario_nome}
            {venda.cliente_nome ? ` · ${venda.cliente_nome}` : ""}
          </p>
          <label className="campo">
            Motivo do cancelamento
            <textarea
              autoFocus
              required
              rows={3}
              placeholder='Ex.: "lançou maracujá em vez de acerola", "venda registrada duas vezes"'
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <p className="texto-suave" style={{ marginTop: "0.6rem" }}>
            Os produtos voltam para o estoque e a venda sai do faturamento. Não dá para desfazer.
          </p>
          <div className="form-acoes">
            <button type="button" className="btn" onClick={onFechar}>
              Voltar
            </button>
            <button className="btn btn-perigo" disabled={salvando || motivo.trim().length < 3}>
              Cancelar venda
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
