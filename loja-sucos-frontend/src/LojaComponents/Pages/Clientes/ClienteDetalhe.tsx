import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, MapPin, PencilSimple, WhatsappLogo } from "@phosphor-icons/react";

import { mensagemErro, useFetchData } from "../../Hooks/FetchData/useFetchData";
import { Endereco, ExtratoFiado, FormaPagamento, TaxaPagamento } from "../../Interfaces";
import {
  NOMES_FORMA_PAGAMENTO,
  data,
  dataHora,
  lerNumero,
  linkMapa,
  linkWhatsApp,
  moeda,
  telefone,
  textoEndereco,
} from "../../Utils/formatar";
import Modal from "../../PagesSections/Modal/Modal";
import FormEndereco from "../../PagesSections/FormEndereco/FormEndereco";
import { ENDERECO_VAZIO, enderecoPreenchido, limparEndereco } from "../../Utils/endereco";
import { acrescimoCartao, percentualTexto } from "../../Utils/taxa";
import style from "./ClienteDetalhe.module.css";

const FORMAS_PAGAMENTO_FIADO: FormaPagamento[] = ["PIX", "DINHEIRO", "DEBITO", "CREDITO"];

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const api = useFetchData();
  const { getExtratoFiado, getEnderecos } = api;

  const [extrato, setExtrato] = useState<ExtratoFiado | null>(null);
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [modal, setModal] = useState<"dados" | "endereco" | "pagamento" | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    const [respExtrato, respEnderecos] = await Promise.all([getExtratoFiado(id), getEnderecos(id)]);
    if (respExtrato.ok) setExtrato(respExtrato.data);
    else toast.error(mensagemErro(respExtrato.data));
    if (respEnderecos.ok) setEnderecos(respEnderecos.data);
  }, [id, getExtratoFiado, getEnderecos]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!extrato) return null;

  const { cliente } = extrato;
  const atual = enderecos.find((e) => e.ativo);
  const historico = enderecos.filter((e) => !e.ativo);

  async function confirmarEndereco() {
    if (!atual) return;
    const resp = await api.confirmarEndereco(cliente.id, atual.id);
    if (resp.ok) {
      toast.success("Endereço confirmado.");
      carregar();
    } else toast.error(mensagemErro(resp.data));
  }

  return (
    <div className="pagina">
      <Link to="/clientes" className="texto-suave">
        <ArrowLeft size={14} /> Clientes
      </Link>

      <div className="pagina-topo">
        <div>
          <h1>{cliente.nome}</h1>
          <p>
            {cliente.telefone ? (
              <a href={linkWhatsApp(cliente.telefone)} target="_blank" rel="noreferrer">
                <WhatsappLogo size={16} /> {telefone(cliente.telefone)}
              </a>
            ) : (
              "Sem telefone"
            )}
            {cliente.observacao && ` · ${cliente.observacao}`}
          </p>
        </div>
        <button className="btn" onClick={() => setModal("dados")}>
          <PencilSimple size={16} /> Editar dados
        </button>
      </div>

      <div className={style.colunas}>
        {/* ===== Endereço ===== */}
        <section className="card">
          <h2>
            <MapPin size={18} weight="duotone" /> Endereço de entrega
          </h2>
          {atual ? (
            <div className={style.endereco}>
              {textoEndereco(atual) && <strong>{textoEndereco(atual)}</strong>}
              {atual.ponto_referencia && <p>Ref.: {atual.ponto_referencia}</p>}
              <p className="texto-suave">
                {atual.confirmado_em ? `Confirmado em ${data(atual.confirmado_em)}` : "Nunca confirmado"}
              </p>
              <div className={style.acoes}>
                {linkMapa(atual) && (
                  <a className="btn btn-pequeno" href={linkMapa(atual)!} target="_blank" rel="noreferrer">
                    Abrir no mapa
                  </a>
                )}
                <button className="btn btn-pequeno" onClick={confirmarEndereco}>
                  <CheckCircle size={16} /> Ainda mora aqui
                </button>
                <button className="btn btn-pequeno btn-primario" onClick={() => setModal("endereco")}>
                  Mudou de endereço
                </button>
              </div>
            </div>
          ) : (
            <div className={style.endereco}>
              <p className="texto-suave">Nenhum endereço cadastrado.</p>
              <div className={style.acoes}>
                <button className="btn btn-pequeno btn-primario" onClick={() => setModal("endereco")}>
                  Cadastrar endereço
                </button>
              </div>
            </div>
          )}

          {historico.length > 0 && (
            <details className={style.historico}>
              <summary>Endereços anteriores ({historico.length})</summary>
              <ul>
                {historico.map((e) => (
                  <li key={e.id}>
                    {textoEndereco(e) || e.ponto_referencia}
                    <span className="texto-suave"> · até {data(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {/* ===== Fiado ===== */}
        <section className="card">
          <h2>Fiado</h2>
          <div className={style.saldo}>
            <div>
              <span className="texto-suave">Saldo devedor</span>
              <strong className={extrato.saldo > 0 ? "texto-perigo" : "texto-verde"}>{moeda(extrato.saldo)}</strong>
            </div>
            <button className="btn btn-primario" disabled={extrato.saldo <= 0} onClick={() => setModal("pagamento")}>
              Registrar pagamento
            </button>
          </div>

          {extrato.pagamentos.length > 0 && (
            <>
              <h3 className={style.subtitulo}>Pagamentos</h3>
              <ul className={style.lista}>
                {extrato.pagamentos.map((p) => (
                  <li key={p.id}>
                    <span>
                      {dataHora(p.pago_em)} · {NOMES_FORMA_PAGAMENTO[p.forma_pagamento]} · recebido por {p.usuario_nome}
                      {p.acrescimo_pagamento > 0 && ` · + ${moeda(p.acrescimo_pagamento)} de acréscimo do cartão`}
                    </span>
                    <strong className="texto-verde">{moeda(p.valor)}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Compras fiado</h2>
        {extrato.vendas.length === 0 ? (
          <p className="vazio">Nenhuma compra fiado.</p>
        ) : (
          <div className="tabela-wrapper">
            <table className="tabela tabela-cartoes">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Produtos</th>
                  <th>Vendido por</th>
                  <th className="num">Total</th>
                  <th className="num">Pago</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {extrato.vendas.map((v) => {
                  const devido = v.valor_total + v.taxa_entrega;
                  const quitada = v.valor_pago >= devido;
                  return (
                    <tr key={v.id}>
                      <td data-rotulo="Quando">{dataHora(v.data_venda)}</td>
                      <td className="principal">
                        {v.itens.map((i) => `${i.quantidade}× ${i.produto_nome}`).join(", ")}
                      </td>
                      <td data-rotulo="Vendido por">{v.usuario_nome}</td>
                      <td className="num" data-rotulo="Total">
                        {moeda(devido)}
                        {v.taxa_entrega > 0 && (
                          <div className="texto-suave">inclui {moeda(v.taxa_entrega)} de entrega</div>
                        )}
                      </td>
                      <td className="num" data-rotulo="Pago">
                        {moeda(v.valor_pago)}
                      </td>
                      <td data-rotulo="Situação">
                        <span
                          className={`badge ${quitada ? "badge-verde" : v.valor_pago > 0 ? "badge-alerta" : "badge-perigo"}`}
                        >
                          {quitada ? "Quitada" : v.valor_pago > 0 ? "Parcial" : "Em aberto"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EditarDadosModal
        aberto={modal === "dados"}
        onFechar={() => setModal(null)}
        clienteId={cliente.id}
        inicial={{ nome: cliente.nome, telefone: cliente.telefone ?? "", observacao: cliente.observacao ?? "" }}
        onSalvo={() => {
          setModal(null);
          carregar();
        }}
      />
      <NovoEnderecoModal
        aberto={modal === "endereco"}
        onFechar={() => setModal(null)}
        clienteId={cliente.id}
        onSalvo={() => {
          setModal(null);
          carregar();
        }}
      />
      <PagamentoModal
        aberto={modal === "pagamento"}
        onFechar={() => setModal(null)}
        clienteId={cliente.id}
        saldo={extrato.saldo}
        onSalvo={() => {
          setModal(null);
          carregar();
        }}
      />
    </div>
  );
}

interface SubModalProps {
  aberto: boolean;
  onFechar: () => void;
  clienteId: string;
  onSalvo: () => void;
}

function EditarDadosModal({
  aberto,
  onFechar,
  clienteId,
  inicial,
  onSalvo,
}: SubModalProps & { inicial: { nome: string; telefone: string; observacao: string } }) {
  const { atualizarCliente } = useFetchData();
  const [dados, setDados] = useState(inicial);

  useEffect(() => {
    if (aberto) setDados(inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const resp = await atualizarCliente(clienteId, {
      nome: dados.nome.trim(),
      telefone: dados.telefone.trim() || null,
      observacao: dados.observacao.trim() || null,
    });
    if (resp.ok) {
      toast.success("Dados atualizados.");
      onSalvo();
    } else toast.error(mensagemErro(resp.data));
  }

  return (
    <Modal titulo="Editar cliente" aberto={aberto} onFechar={onFechar}>
      <form onSubmit={salvar}>
        <div className="form-grid">
          <label className="campo">
            Nome
            <input required value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} />
          </label>
          <label className="campo">
            WhatsApp / telefone
            <input value={dados.telefone} onChange={(e) => setDados({ ...dados, telefone: e.target.value })} />
          </label>
          <label className="campo" style={{ gridColumn: "1 / -1" }}>
            Observação
            <input value={dados.observacao} onChange={(e) => setDados({ ...dados, observacao: e.target.value })} />
          </label>
        </div>
        <div className="form-acoes">
          <button type="button" className="btn" onClick={onFechar}>
            Cancelar
          </button>
          <button className="btn btn-primario">Salvar</button>
        </div>
      </form>
    </Modal>
  );
}

function NovoEnderecoModal({ aberto, onFechar, clienteId, onSalvo }: SubModalProps) {
  const { cadastrarEndereco } = useFetchData();
  const [endereco, setEndereco] = useState(ENDERECO_VAZIO);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const resp = await cadastrarEndereco(clienteId, limparEndereco(endereco));
    if (resp.ok) {
      toast.success("Novo endereço salvo. O anterior ficou no histórico.");
      setEndereco(ENDERECO_VAZIO);
      onSalvo();
    } else toast.error(mensagemErro(resp.data));
  }

  return (
    <Modal titulo="Novo endereço" aberto={aberto} onFechar={onFechar} largura={640}>
      <form onSubmit={salvar}>
        <FormEndereco valor={endereco} onChange={setEndereco} />
        <div className="form-acoes">
          <button type="button" className="btn" onClick={onFechar}>
            Cancelar
          </button>
          <button className="btn btn-primario" disabled={!enderecoPreenchido(endereco)}>
            Salvar endereço
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PagamentoModal({ aberto, onFechar, clienteId, saldo, onSalvo }: SubModalProps & { saldo: number }) {
  const { registrarPagamentoFiado, getTaxas } = useFetchData();
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState<FormaPagamento>("DINHEIRO");
  const [enviando, setEnviando] = useState(false);
  const [taxas, setTaxas] = useState<TaxaPagamento[]>([]);

  useEffect(() => {
    if (aberto) getTaxas().then((resp) => resp.ok && setTaxas(resp.data));
  }, [aberto, getTaxas]);

  const valorNumero = lerNumero(valor);
  const acrescimo = valorNumero > 0 ? acrescimoCartao(valorNumero, forma, taxas) : 0;
  const valido = valorNumero > 0 && valorNumero <= saldo;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const resp = await registrarPagamentoFiado({ cliente_id: clienteId, valor: valorNumero, forma_pagamento: forma });
      if (resp.ok) {
        toast.success(`Pagamento de ${moeda(valorNumero)} registrado (abatido da dívida).`);
        setValor("");
        onSalvo();
      } else toast.error(mensagemErro(resp.data));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo="Registrar pagamento do fiado" aberto={aberto} onFechar={onFechar} largura={440}>
      <form onSubmit={salvar}>
        <p className="texto-suave" style={{ marginBottom: "0.8rem" }}>
          Saldo devedor: <strong>{moeda(saldo)}</strong>. O valor quita primeiro as compras mais antigas.
        </p>
        <div className="form-grid">
          <label className="campo">
            Valor recebido
            <input
              autoFocus
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </label>
          <label className="campo">
            Forma
            <select value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
              {FORMAS_PAGAMENTO_FIADO.map((f) => (
                <option key={f} value={f}>
                  {NOMES_FORMA_PAGAMENTO[f]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {acrescimo > 0 && (
          <p style={{ marginTop: "0.8rem" }}>
            Passar na máquina: <strong>{moeda(valorNumero + acrescimo)}</strong>{" "}
            <span className="texto-suave">
              ({moeda(valorNumero)} da dívida + {moeda(acrescimo)} de acréscimo do cartão,{" "}
              {percentualTexto(forma, taxas)})
            </span>
          </p>
        )}
        <div className="form-acoes">
          <button type="button" className="btn" onClick={() => setValor(String(saldo).replace(".", ","))}>
            Quitar tudo
          </button>
          <button className="btn btn-primario" disabled={!valido || enviando}>
            Registrar
          </button>
        </div>
      </form>
    </Modal>
  );
}
