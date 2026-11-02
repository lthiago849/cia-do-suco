import { FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChatText, ClipboardText, Minus, Plus, Trash, UserPlus } from "@phosphor-icons/react";

import { mensagemErro, useFetchData } from "../../Hooks/FetchData/useFetchData";
import { Cliente, FormaPagamento, MembroEquipe, Pedido, Produto, TaxaPagamento } from "../../Interfaces";
import { NOMES_CATEGORIA, NOMES_FORMA_PAGAMENTO, lerNumero, moeda, textoEndereco } from "../../Utils/formatar";
import Modal from "../../PagesSections/Modal/Modal";
import { acrescimoCartao, percentualTexto } from "../../Utils/taxa";
import { lerPedido } from "../../Utils/lerPedido";
import { lerAreaDeTransferencia } from "../../Utils/compartilhar";
import BuscaCliente from "../../PagesSections/BuscaCliente/BuscaCliente";
import SelecaoBusca from "../../PagesSections/SelecaoBusca/SelecaoBusca";
import NovoClienteModal from "../Clientes/NovoClienteModal";
import style from "./Entregas.module.css";

const FORMAS: FormaPagamento[] = ["PIX", "DINHEIRO", "DEBITO", "CREDITO", "FIADO"];

interface ModalBaseProps {
  aberto: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}

/** Novo pedido (atendente) ou revisão de um pedido que ainda não foi entregue.
 * textoInicial: mensagem do cliente compartilhada do WhatsApp, lida assim que o modal abre. */
export function PedidoModal({
  aberto,
  onFechar,
  onSalvo,
  pedido,
  textoInicial = "",
}: ModalBaseProps & { pedido: Pedido | null; textoInicial?: string }) {
  const { getProdutos, getClientes, criarPedido, atualizarPedido } = useFetchData();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [itens, setItens] = useState<Record<string, number>>({});
  const [forma, setForma] = useState<FormaPagamento | "">("");
  const [observacao, setObservacao] = useState("");
  const [usarEnderecoAtual, setUsarEnderecoAtual] = useState(false);
  const [novoCliente, setNovoCliente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [leitura, setLeitura] = useState<{ resumo: string; avisos: string[] } | null>(null);
  const [buscaSugerida, setBuscaSugerida] = useState("");
  const textoLido = useRef("");

  useEffect(() => {
    if (!aberto) return;
    getProdutos({ ativo: true }).then((resp) => resp.ok && setProdutos(resp.data));
    setItens(pedido ? Object.fromEntries(pedido.itens.map((i) => [i.produto_id, i.quantidade])) : {});
    setForma(pedido?.forma_pagamento ?? "");
    setObservacao(pedido?.observacao ?? "");
    setCliente(null);
    setUsarEnderecoAtual(false);
    setMensagem(textoInicial);
    setLeitura(null);
    setBuscaSugerida("");
    textoLido.current = "";
  }, [aberto, pedido, textoInicial, getProdutos]);

  // Mensagem compartilhada do WhatsApp: preenche sozinho quando os produtos carregarem
  useEffect(() => {
    if (aberto && textoInicial && produtos.length && textoLido.current !== textoInicial) {
      textoLido.current = textoInicial;
      preencherPelaMensagem(textoInicial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, textoInicial, produtos]);

  const porId = Object.fromEntries(produtos.map((p) => [p.id, p]));
  const ordemCategoria = Object.keys(NOMES_CATEGORIA);
  const opcoesProduto = [...produtos]
    .sort((a, b) => ordemCategoria.indexOf(a.categoria) - ordemCategoria.indexOf(b.categoria))
    .map((p) => ({
      valor: p.id,
      rotulo: `${NOMES_CATEGORIA[p.categoria]} — ${p.nome}`,
      detalhe: `${moeda(p.preco_venda)} · tem ${p.quantidade_estoque}`,
      grupo: NOMES_CATEGORIA[p.categoria],
    }));
  const linhas = Object.entries(itens).filter(([id]) => porId[id]);
  const total = linhas.reduce((s, [id, qtd]) => s + porId[id].preco_venda * qtd, 0);

  function alterar(id: string, delta: number) {
    setItens((atual) => {
      const nova = (atual[id] ?? 0) + delta;
      const { [id]: _removido, ...resto } = atual;
      void _removido;
      return nova > 0 ? { ...resto, [id]: nova } : resto;
    });
  }

  async function preencherPelaMensagem(texto: string) {
    const lido = lerPedido(texto, produtos);
    // "Morango" sozinho não diz se é picolé ou moreninha
    const nomes = Object.fromEntries(
      produtos.map((p) => [
        p.id,
        p.categoria === "SUCO" ? p.nome : `${NOMES_CATEGORIA[p.categoria].replace(/s$/, "")} ${p.nome}`,
      ]),
    );
    if (lido.itens.length) setItens(Object.fromEntries(lido.itens.map((i) => [i.produto_id, i.quantidade])));
    if (lido.forma_pagamento) setForma(lido.forma_pagamento);
    if (lido.observacao) {
      const nota = lido.observacao;
      setObservacao((atual) => (atual.includes(nota) ? atual : [atual, nota].filter(Boolean).join(" · ")));
    }

    const partes = lido.itens.map((i) => `${i.quantidade}× ${nomes[i.produto_id]}`);
    if (lido.forma_pagamento) partes.push(NOMES_FORMA_PAGAMENTO[lido.forma_pagamento]);
    if (lido.observacao) partes.push(lido.observacao);
    const avisos = lido.nao_reconhecidos.map((t) => `Não achei no cardápio: "${t}"`);
    if (!lido.itens.length) avisos.unshift("Nenhum produto reconhecido. Adicione manualmente.");

    // Cliente: pelo telefone escrito na mensagem ou pelo nome ("meu nome é...", "aqui é a...")
    if (!pedido && !cliente) {
      for (const termo of [lido.telefone, lido.nome_cliente]) {
        if (!termo) continue;
        const resp = await getClientes(termo);
        if (resp.ok && resp.data.length === 1) {
          setCliente(resp.data[0]);
          partes.push(`cliente ${resp.data[0].nome}`);
          break;
        }
        if (resp.ok && resp.data.length > 1) {
          setBuscaSugerida(termo);
          break;
        }
      }
    }
    setLeitura({ resumo: partes.join(" · "), avisos });
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const listaItens = linhas.map(([produto_id, quantidade]) => ({ produto_id, quantidade }));
    try {
      const resp = pedido
        ? await atualizarPedido(pedido.id, {
            itens: listaItens,
            forma_pagamento: forma || null,
            observacao: observacao.trim() || null,
            // null = usar o endereço atual do cliente
            ...(usarEnderecoAtual ? { endereco_id: null } : {}),
          })
        : await criarPedido({
            cliente_id: cliente!.id,
            itens: listaItens,
            forma_pagamento: forma || null,
            observacao: observacao.trim() || null,
          });
      if (resp.ok) {
        toast.success(pedido ? "Pedido revisado." : `Pedido de ${resp.data.cliente_nome} criado.`);
        onSalvo();
      } else toast.error(mensagemErro(resp.data));
    } finally {
      setEnviando(false);
    }
  }

  const valido = (pedido || cliente) && linhas.length > 0;

  return (
    <Modal
      titulo={pedido ? `Revisar pedido de ${pedido.cliente_nome}` : "Novo pedido de entrega"}
      aberto={aberto}
      onFechar={onFechar}
      largura={620}
    >
      <form onSubmit={salvar} className={style.formPedido}>
        {!pedido && (
          <div className="campo">
            Mensagem do cliente (opcional)
            <textarea
              rows={3}
              placeholder="Cole aqui a mensagem do WhatsApp, ex.: 2 de acerola e 1 cupuaçu, pix"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
            />
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-pequeno"
                disabled={!produtos.length}
                onClick={async () => {
                  const texto = await lerAreaDeTransferencia();
                  if (!texto) {
                    toast.info("Não consegui ler o que foi copiado. Segure no campo acima e escolha Colar.");
                    return;
                  }
                  setMensagem(texto);
                  preencherPelaMensagem(texto);
                }}
              >
                <ClipboardText size={16} /> Colar e preencher
              </button>
              <button
                type="button"
                className="btn btn-pequeno"
                disabled={!mensagem.trim() || !produtos.length}
                onClick={() => preencherPelaMensagem(mensagem)}
              >
                <ChatText size={16} /> Preencher pelo texto
              </button>
            </div>
            {leitura && (
              <div className={style.leitura}>
                {leitura.resumo && <span>Entendi: {leitura.resumo}. Confira antes de criar.</span>}
                {leitura.avisos.map((aviso) => (
                  <span key={aviso} className="texto-perigo">
                    {aviso}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {!pedido && (
          <div className="campo">
            Cliente
            <BuscaCliente selecionado={cliente} onSelecionar={setCliente} buscaInicial={buscaSugerida} />
            {!cliente && (
              <button
                type="button"
                className="btn btn-pequeno"
                style={{ alignSelf: "flex-start" }}
                onClick={() => setNovoCliente(true)}
              >
                <UserPlus size={16} /> Cadastrar cliente novo
              </button>
            )}
            {cliente && (
              <span className={cliente.endereco_atual ? "texto-suave" : "texto-perigo"}>
                {cliente.endereco_atual
                  ? `Entrega em: ${textoEndereco(cliente.endereco_atual) || cliente.endereco_atual.ponto_referencia}`
                  : "Cliente sem endereço: cadastre no perfil dele antes de mandar para entrega."}
              </span>
            )}
          </div>
        )}

        {pedido && (
          <label className="campo-check">
            <input
              type="checkbox"
              checked={usarEnderecoAtual}
              onChange={(e) => setUsarEnderecoAtual(e.target.checked)}
            />
            Usar o endereço atual do cadastro do cliente (se ele mudou de endereço depois do pedido)
          </label>
        )}

        <div className="campo">
          Produtos
          {/* Escolher na busca já adiciona 1 unidade ao pedido; a busca fica livre para o próximo produto */}
          <SelecaoBusca
            opcoes={opcoesProduto}
            valor=""
            onChange={(id) => id && alterar(id, 1)}
            placeholder="Digite para adicionar (ex.: caju, picolé)"
          />
          {linhas.length > 0 && (
            <ul className={style.listaItens}>
              {linhas.map(([id, qtd]) => (
                <li key={id}>
                  <span>
                    {porId[id].nome} <span className="texto-suave">· {NOMES_CATEGORIA[porId[id].categoria]}</span>
                    {qtd > porId[id].quantidade_estoque && (
                      <span className="badge badge-alerta" style={{ marginLeft: 6 }}>
                        estoque: {porId[id].quantidade_estoque}
                      </span>
                    )}
                  </span>
                  <span className={style.quantidade}>
                    <button
                      type="button"
                      className="btn btn-pequeno"
                      onClick={() => alterar(id, -1)}
                      aria-label="Menos"
                    >
                      <Minus size={14} />
                    </button>
                    <strong>{qtd}</strong>
                    <button type="button" className="btn btn-pequeno" onClick={() => alterar(id, 1)} aria-label="Mais">
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-pequeno btn-perigo"
                      onClick={() => alterar(id, -qtd)}
                      aria-label="Remover"
                    >
                      <Trash size={14} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <strong style={{ alignSelf: "flex-end", color: "var(--cor-texto)" }}>Produtos: {moeda(total)}</strong>
        </div>

        <div className="form-grid">
          <label className="campo">
            Forma de pagamento (opcional)
            <select value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento | "")}>
              <option value="">A definir na entrega</option>
              {FORMAS.map((f) => (
                <option key={f} value={f}>
                  {NOMES_FORMA_PAGAMENTO[f]}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Observação
            <input
              placeholder='Ex.: "troco para 50", "sem açúcar"'
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </label>
        </div>

        <div className="form-acoes">
          <button type="button" className="btn" onClick={onFechar}>
            Cancelar
          </button>
          <button className="btn btn-primario" disabled={!valido || enviando}>
            {pedido ? "Salvar revisão" : "Criar pedido"}
          </button>
        </div>
      </form>

      <NovoClienteModal
        aberto={novoCliente}
        onFechar={() => setNovoCliente(false)}
        onCriado={(c) => {
          setCliente(c);
          setNovoCliente(false);
        }}
      />
    </Modal>
  );
}

/** Confirma a entrega informando quem entregou: o pedido vira venda e a taxa de entrega fica para o entregador */
export function EntregaModal({ aberto, onFechar, onSalvo, pedido }: ModalBaseProps & { pedido: Pedido | null }) {
  const { getEquipe, getTaxas, entregarPedido } = useFetchData();
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [taxas, setTaxas] = useState<TaxaPagamento[]>([]);
  const [entregador, setEntregador] = useState("");
  const [taxa, setTaxa] = useState("");
  const [forma, setForma] = useState<FormaPagamento | "">("");
  // Pagamento já informado no pedido: mostra como decidido, e só abre o seletor se o cliente mudou na hora
  const [trocarForma, setTrocarForma] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setEntregador("");
    setTaxa("");
    setForma(pedido?.forma_pagamento ?? "");
    setTrocarForma(false);
    getEquipe().then((resp) => resp.ok && setEquipe(resp.data));
    getTaxas().then((resp) => resp.ok && setTaxas(resp.data));
  }, [aberto, pedido, getEquipe, getTaxas]);

  if (!pedido) return null;
  const valorTaxa = lerNumero(taxa);
  const nomeEntregador = equipe.find((m) => m.id === entregador)?.nome;
  const taxaEntrega = valorTaxa >= 0 ? valorTaxa : 0;
  // Cliente paga produtos + entrega numa nota só; o acréscimo do cartão é sobre tudo
  const acrescimo = acrescimoCartao(pedido.total_produtos + taxaEntrega, forma, taxas);
  const totalCliente = pedido.total_produtos + taxaEntrega + acrescimo;
  const ehCartao = forma === "DEBITO" || forma === "CREDITO";
  const formaDoPedido = pedido.forma_pagamento && !trocarForma;
  const valido = !!entregador && valorTaxa >= 0 && !!forma;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!pedido || !forma) return;
    setEnviando(true);
    try {
      const resp = await entregarPedido(pedido.id, {
        entregador_id: entregador,
        taxa_entrega: valorTaxa,
        forma_pagamento: forma,
      });
      if (resp.ok) {
        toast.success(`Entrega para ${pedido.cliente_nome} confirmada e venda registrada.`);
        onSalvo();
      } else toast.error(mensagemErro(resp.data));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo={`Confirmar entrega — ${pedido.cliente_nome}`} aberto={aberto} onFechar={onFechar} largura={460}>
      <form onSubmit={salvar}>
        <div className="form-grid">
          <label className="campo" style={{ gridColumn: "1 / -1" }}>
            Quem entregou?
            <select autoFocus required value={entregador} onChange={(e) => setEntregador(e.target.value)}>
              <option value="">Escolha...</option>
              {equipe.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Taxa de entrega (R$)
            <input
              required
              inputMode="decimal"
              placeholder="0,00"
              value={taxa}
              onChange={(e) => setTaxa(e.target.value)}
            />
          </label>
          {formaDoPedido ? (
            <div className="campo">
              Pagamento
              <div className={style.formaDecidida}>
                <span>
                  <strong>{NOMES_FORMA_PAGAMENTO[pedido.forma_pagamento!]}</strong>
                  <span className="texto-suave"> · informado no pedido</span>
                </span>
                <button type="button" className="btn btn-pequeno" onClick={() => setTrocarForma(true)}>
                  Trocar
                </button>
              </div>
            </div>
          ) : (
            <label className="campo">
              Como o cliente pagou
              <select required value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento | "")}>
                <option value="">Escolha...</option>
                {FORMAS.map((f) => (
                  <option key={f} value={f}>
                    {NOMES_FORMA_PAGAMENTO[f]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <dl className={style.resumoEntrega}>
          <dt>Produtos</dt>
          <dd>{moeda(pedido.total_produtos)}</dd>
          <dt>Taxa de entrega{nomeEntregador ? ` (${nomeEntregador})` : ""}</dt>
          <dd>{moeda(taxaEntrega)}</dd>
          {acrescimo > 0 && (
            <>
              <dt>Acréscimo do cartão ({percentualTexto(forma, taxas)})</dt>
              <dd>{moeda(acrescimo)}</dd>
            </>
          )}
          <dt>
            <strong>
              {forma === "FIADO" ? "Vai para o fiado" : ehCartao ? "Passar na máquina" : "Cobrar do cliente"}
            </strong>
          </dt>
          <dd>
            <strong>{moeda(totalCliente)}</strong>
          </dd>
        </dl>
        <p className="texto-suave">
          O cliente paga produtos e entrega juntos. A taxa de entrega fica anotada para{" "}
          {nomeEntregador ?? "o entregador"} receber no fim do dia e não conta como faturamento.
          {forma === "FIADO" && " Produtos e entrega entram no fiado do cliente."}
        </p>
        <div className="form-acoes">
          <button type="button" className="btn" onClick={onFechar}>
            Voltar
          </button>
          <button className="btn btn-primario" disabled={!valido || enviando}>
            Confirmar entrega
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CancelarPedidoModal({ aberto, onFechar, onSalvo, pedido }: ModalBaseProps & { pedido: Pedido | null }) {
  const { cancelarPedido } = useFetchData();
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (aberto) setMotivo("");
  }, [aberto]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!pedido) return;
    const resp = await cancelarPedido(pedido.id, motivo.trim());
    if (resp.ok) {
      toast.success("Pedido cancelado.");
      onSalvo();
    } else toast.error(mensagemErro(resp.data));
  }

  return (
    <Modal titulo="Cancelar pedido" aberto={aberto} onFechar={onFechar} largura={440}>
      <form onSubmit={salvar}>
        <label className="campo">
          Motivo
          <input
            autoFocus
            required
            placeholder='Ex.: "cliente desistiu", "não encontramos o endereço"'
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </label>
        <div className="form-acoes">
          <button type="button" className="btn" onClick={onFechar}>
            Voltar
          </button>
          <button className="btn btn-perigo" disabled={motivo.trim().length < 3}>
            Cancelar pedido
          </button>
        </div>
      </form>
    </Modal>
  );
}
