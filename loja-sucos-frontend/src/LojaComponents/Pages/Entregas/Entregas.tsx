import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ClipboardText, Clock, MapPin, Plus, WhatsappLogo } from "@phosphor-icons/react";

import { mensagemErro, useFetchData } from "../../Hooks/FetchData/useFetchData";
import { EntregadorResumo, Pedido, Periodo, StatusPedido } from "../../Interfaces";
import {
  NOMES_FORMA_PAGAMENTO,
  dataHora,
  hojeISO,
  linkMapa,
  linkWhatsApp,
  moeda,
  telefone,
  textoEndereco,
} from "../../Utils/formatar";
import SeletorPeriodo from "../../PagesSections/SeletorPeriodo/SeletorPeriodo";
import { lerAreaDeTransferencia, pegarMensagemCompartilhada } from "../../Utils/compartilhar";
import { CancelarPedidoModal, EntregaModal, PedidoModal } from "./ModaisPedido";
import style from "./Entregas.module.css";

const NOMES_STATUS: Record<StatusPedido, string> = {
  NOVO: "Aguardando entrega",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

const CLASSE_STATUS: Record<StatusPedido, string> = {
  NOVO: "badge-alerta",
  ENTREGUE: "badge-verde",
  CANCELADO: "badge-perigo",
};

type Acao = "revisar" | "entrega" | "cancelar";

function haQuanto(iso: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return horas < 24 ? `há ${horas}h${String(minutos % 60).padStart(2, "0")}` : dataHora(iso);
}

function resumoItens(pedido: Pedido) {
  return pedido.itens.map((i) => `${i.quantidade}× ${i.produto_nome}`).join(", ");
}

export default function Entregas() {
  const { getPedidos, getResumoEntregadores } = useFetchData();
  const [aba, setAba] = useState<"abertos" | "historico">("abertos");
  const [abertos, setAbertos] = useState<Pedido[]>([]);
  const [historico, setHistorico] = useState<Pedido[]>([]);
  const [entregadores, setEntregadores] = useState<EntregadorResumo[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>({ data_inicio: hojeISO(-6), data_fim: hojeISO() });
  // Mensagem do cliente (compartilhada ou copiada do WhatsApp): já abre o pedido novo com ela
  const [mensagemInicial, setMensagemInicial] = useState(pegarMensagemCompartilhada);
  const [novoPedido, setNovoPedido] = useState(!!mensagemInicial);
  const [acao, setAcao] = useState<{ tipo: Acao; pedido: Pedido } | null>(null);

  const carregarAbertos = useCallback(async () => {
    const resp = await getPedidos({ abertos: true });
    if (resp.ok) setAbertos(resp.data);
    else toast.error(mensagemErro(resp.data));
  }, [getPedidos]);

  const carregarHistorico = useCallback(async () => {
    const [h, e] = await Promise.all([getPedidos(periodo), getResumoEntregadores(periodo)]);
    if (h.ok) setHistorico(h.data.filter((p) => p.status === "ENTREGUE" || p.status === "CANCELADO"));
    if (e.ok) setEntregadores(e.data);
  }, [getPedidos, getResumoEntregadores, periodo]);

  useEffect(() => {
    carregarAbertos();
    // Pedidos do WhatsApp chegam sozinhos: atualiza a fila a cada 30 s
    const timer = setInterval(carregarAbertos, 30_000);
    return () => clearInterval(timer);
  }, [carregarAbertos]);

  useEffect(() => {
    if (aba === "historico") carregarHistorico();
  }, [aba, carregarHistorico]);

  async function colarDoWhatsApp() {
    const texto = await lerAreaDeTransferencia();
    if (!texto) {
      toast.info('Não consegui ler o que foi copiado. Cole a mensagem no campo "Mensagem do cliente".');
    }
    setMensagemInicial(texto);
    setNovoPedido(true);
  }

  function aposAcao() {
    setAcao(null);
    setNovoPedido(false);
    setMensagemInicial("");
    carregarAbertos();
    if (aba === "historico") carregarHistorico();
  }

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Entregas</h1>
          <p>Revise os pedidos e confirme a entrega informando quem entregou. Só aí o pedido vira venda.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button className="btn" onClick={colarDoWhatsApp}>
            <ClipboardText size={18} /> Colar pedido do WhatsApp
          </button>
          <button className="btn btn-primario" onClick={() => setNovoPedido(true)}>
            <Plus size={18} /> Novo pedido
          </button>
        </div>
      </div>

      <div className="abas">
        <button className={`aba ${aba === "abertos" ? "ativa" : ""}`} onClick={() => setAba("abertos")}>
          Aguardando entrega ({abertos.length})
        </button>
        <button className={`aba ${aba === "historico" ? "ativa" : ""}`} onClick={() => setAba("historico")}>
          Histórico
        </button>
      </div>

      {aba === "abertos" &&
        (abertos.length === 0 ? (
          <div className="card vazio">Nenhum pedido em aberto.</div>
        ) : (
          <div className={style.fila}>
            {abertos.map((p) => (
              <article key={p.id} className={`card ${style.pedido}`}>
                <header className={style.pedidoTopo}>
                  <div>
                    <Link to={`/clientes/${p.cliente_id}`}>
                      <strong>{p.cliente_nome}</strong>
                    </Link>
                    {p.cliente_telefone && (
                      <a
                        className={style.whats}
                        href={linkWhatsApp(p.cliente_telefone)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <WhatsappLogo size={15} /> {telefone(p.cliente_telefone)}
                      </a>
                    )}
                  </div>
                  <div className={style.badges}>
                    {p.origem === "WHATSAPP" && <span className="badge badge-verde">WhatsApp</span>}
                  </div>
                </header>

                <p className="texto-suave">
                  <Clock size={14} /> Chegou {haQuanto(p.created_at)}
                  {p.criado_por_nome && ` · cadastrado por ${p.criado_por_nome}`}
                </p>

                <div className={style.endereco}>
                  <MapPin size={16} weight="duotone" />
                  {p.endereco ? (
                    <div>
                      {textoEndereco(p.endereco) && <div>{textoEndereco(p.endereco)}</div>}
                      {p.endereco.ponto_referencia && (
                        <div className="texto-suave">Ref.: {p.endereco.ponto_referencia}</div>
                      )}
                      {linkMapa(p.endereco) && (
                        <a href={linkMapa(p.endereco)!} target="_blank" rel="noreferrer">
                          Abrir no mapa
                        </a>
                      )}
                    </div>
                  ) : (
                    <span className="texto-perigo">
                      Sem endereço — <Link to={`/clientes/${p.cliente_id}`}>cadastrar no perfil do cliente</Link>
                    </span>
                  )}
                </div>

                <ul className={style.itens}>
                  {p.itens.map((i) => (
                    <li key={i.produto_id}>
                      <span>
                        {i.quantidade}× {i.produto_nome}
                        {i.quantidade > i.estoque_disponivel && (
                          <span className="badge badge-alerta" style={{ marginLeft: 6 }}>
                            estoque: {i.estoque_disponivel}
                          </span>
                        )}
                      </span>
                      <span>{moeda(i.subtotal)}</span>
                    </li>
                  ))}
                </ul>

                <div className={style.totais}>
                  <span>
                    {p.forma_pagamento ? (
                      NOMES_FORMA_PAGAMENTO[p.forma_pagamento]
                    ) : (
                      <span className="texto-suave">Pagamento a definir</span>
                    )}
                  </span>
                  <strong>{moeda(p.total_produtos)}</strong>
                </div>
                {p.observacao && <p className={style.observacao}>“{p.observacao}”</p>}

                <footer className={style.acoes}>
                  <button className="btn btn-pequeno" onClick={() => setAcao({ tipo: "revisar", pedido: p })}>
                    Revisar
                  </button>
                  <button
                    className="btn btn-pequeno btn-primario"
                    disabled={!p.endereco}
                    title={p.endereco ? undefined : "Cadastre o endereço do cliente primeiro"}
                    onClick={() => setAcao({ tipo: "entrega", pedido: p })}
                  >
                    Confirmar entrega
                  </button>
                  <button
                    className="btn btn-pequeno btn-perigo"
                    onClick={() => setAcao({ tipo: "cancelar", pedido: p })}
                  >
                    Cancelar
                  </button>
                </footer>
              </article>
            ))}
          </div>
        ))}

      {aba === "historico" && (
        <>
          <div className="card">
            <SeletorPeriodo periodo={periodo} onChange={setPeriodo} />
          </div>

          <div className="card">
            <h2>Entregas por entregador</h2>
            {entregadores.length === 0 ? (
              <p className="vazio">Nenhuma entrega confirmada no período.</p>
            ) : (
              <table className="tabela tabela-cartoes">
                <thead>
                  <tr>
                    <th>Entregador</th>
                    <th className="num">Entregas</th>
                    <th className="num">Taxas a repassar</th>
                  </tr>
                </thead>
                <tbody>
                  {entregadores.map((e) => (
                    <tr key={e.entregador_id}>
                      <td className="principal">{e.nome}</td>
                      <td className="num" data-rotulo="Entregas">
                        {e.entregas}
                      </td>
                      <td className="num" data-rotulo="Taxas a repassar">
                        {moeda(e.total_taxas)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h2>Pedidos</h2>
            {historico.length === 0 ? (
              <p className="vazio">Nenhum pedido entregue ou cancelado no período.</p>
            ) : (
              <div className="tabela-wrapper">
                <table className="tabela tabela-cartoes">
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Cliente / endereço</th>
                      <th>Produtos</th>
                      <th>Entrega</th>
                      <th className="num">Produtos</th>
                      <th className="num">Taxa entrega</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((p) => (
                      <tr key={p.id}>
                        <td data-rotulo="Pedido">
                          {dataHora(p.created_at)}
                          <div className="texto-suave">
                            {p.origem === "WHATSAPP" ? "WhatsApp" : `por ${p.criado_por_nome}`}
                          </div>
                        </td>
                        <td className="principal">
                          <Link to={`/clientes/${p.cliente_id}`}>{p.cliente_nome}</Link>
                          {p.endereco && (
                            <div className="texto-suave">
                              {textoEndereco(p.endereco) || p.endereco.ponto_referencia}
                            </div>
                          )}
                        </td>
                        <td data-rotulo="Produtos">{resumoItens(p)}</td>
                        <td data-rotulo="Entrega">
                          <span className={`badge ${CLASSE_STATUS[p.status]}`}>{NOMES_STATUS[p.status]}</span>
                          {p.status === "ENTREGUE" ? (
                            <div className="texto-suave">
                              {dataHora(p.entregue_em!)} · {p.entregador_nome}
                              <br />
                              {p.forma_pagamento && NOMES_FORMA_PAGAMENTO[p.forma_pagamento]} · confirmado por{" "}
                              {p.confirmado_por_nome}
                            </div>
                          ) : (
                            <div className="texto-suave">
                              {p.motivo_cancelamento} · {p.cancelado_por_nome}
                            </div>
                          )}
                        </td>
                        <td className="num" data-rotulo="Valor dos produtos">
                          {moeda(p.total_produtos)}
                        </td>
                        <td className="num" data-rotulo="Taxa de entrega">
                          {p.taxa_entrega !== null ? moeda(p.taxa_entrega) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <PedidoModal
        aberto={novoPedido}
        pedido={null}
        textoInicial={mensagemInicial}
        onFechar={() => {
          setNovoPedido(false);
          setMensagemInicial("");
        }}
        onSalvo={aposAcao}
      />
      <PedidoModal
        aberto={acao?.tipo === "revisar"}
        pedido={acao?.tipo === "revisar" ? acao.pedido : null}
        onFechar={() => setAcao(null)}
        onSalvo={aposAcao}
      />
      <EntregaModal
        aberto={acao?.tipo === "entrega"}
        pedido={acao?.pedido ?? null}
        onFechar={() => setAcao(null)}
        onSalvo={aposAcao}
      />
      <CancelarPedidoModal
        aberto={acao?.tipo === "cancelar"}
        pedido={acao?.pedido ?? null}
        onFechar={() => setAcao(null)}
        onSalvo={aposAcao}
      />
    </div>
  );
}
