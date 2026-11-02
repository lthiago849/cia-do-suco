import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { mensagemErro, useFetchData } from "../../Hooks/FetchData/useFetchData";
import { Cliente } from "../../Interfaces";
import Modal from "../../PagesSections/Modal/Modal";
import FormEndereco from "../../PagesSections/FormEndereco/FormEndereco";
import { ENDERECO_VAZIO, enderecoPreenchido, limparEndereco } from "../../Utils/endereco";

interface NovoClienteModalProps {
  aberto: boolean;
  onFechar: () => void;
  onCriado: (cliente: Cliente) => void;
}

export default function NovoClienteModal({ aberto, onFechar, onCriado }: NovoClienteModalProps) {
  const { criarCliente } = useFetchData();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacao, setObservacao] = useState("");
  const [endereco, setEndereco] = useState(ENDERECO_VAZIO);
  const [enviando, setEnviando] = useState(false);

  function limpar() {
    setNome("");
    setTelefone("");
    setObservacao("");
    setEndereco(ENDERECO_VAZIO);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const resp = await criarCliente({
        nome: nome.trim(),
        telefone: telefone.trim() || undefined,
        observacao: observacao.trim() || undefined,
        endereco: enderecoPreenchido(endereco) ? limparEndereco(endereco) : undefined,
      });
      if (!resp.ok) {
        toast.error(mensagemErro(resp.data));
        return;
      }
      toast.success(`Cliente ${resp.data.nome} cadastrado.`);
      limpar();
      onCriado(resp.data);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo="Novo cliente" aberto={aberto} onFechar={onFechar} largura={640}>
      <form onSubmit={salvar}>
        <div className="form-grid">
          <label className="campo">
            Nome *
            <input autoFocus required value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="campo">
            WhatsApp / telefone
            <input placeholder="(91) 98888-7777" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </label>
          <label className="campo" style={{ gridColumn: "1 / -1" }}>
            Observação
            <input
              placeholder='Ex.: "amigo da tia Maria", "só pede de tarde"'
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </label>
        </div>

        <h2 style={{ margin: "1.2rem 0 0.6rem" }}>Endereço (opcional)</h2>
        <FormEndereco valor={endereco} onChange={setEndereco} />

        <div className="form-acoes">
          <button type="button" className="btn" onClick={onFechar}>
            Cancelar
          </button>
          <button className="btn btn-primario" disabled={enviando || !nome.trim()}>
            Salvar cliente
          </button>
        </div>
      </form>
    </Modal>
  );
}
