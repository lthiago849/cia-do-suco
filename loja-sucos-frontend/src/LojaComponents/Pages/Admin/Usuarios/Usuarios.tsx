import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EnvelopeSimple, PaperPlaneTilt, PencilSimple, UserPlus } from "@phosphor-icons/react";

import { useGlobalContext } from "../../../GlobalContext";
import { mensagemErro, useFetchData } from "../../../Hooks/FetchData/useFetchData";
import { RelatorioEstoque, TipoUsuario, Usuario } from "../../../Interfaces";
import { data, dataHora, telefone } from "../../../Utils/formatar";
import Modal from "../../../PagesSections/Modal/Modal";

interface FormUsuario {
  nome_usuario: string;
  nome: string;
  email: string;
  senha: string;
  tipo: TipoUsuario;
  telefone: string;
  recebe_relatorio: boolean;
  ativo: boolean;
}

const FORM_VAZIO: FormUsuario = {
  nome_usuario: "",
  nome: "",
  email: "",
  senha: "",
  tipo: "ATENDENTE",
  telefone: "",
  recebe_relatorio: true,
  ativo: true,
};

export default function Usuarios() {
  const { account } = useGlobalContext();
  const { getUsuarios, criarUsuario, atualizarUsuario, getRelatorioEstoque, enviarRelatorioEstoque } = useFetchData();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<FormUsuario>(FORM_VAZIO);
  const [previa, setPrevia] = useState<RelatorioEstoque | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    const [u, p] = await Promise.all([getUsuarios(), getRelatorioEstoque()]);
    if (u.ok) setUsuarios(u.data);
    if (p.ok) setPrevia(p.data);
  }, [getUsuarios, getRelatorioEstoque]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrir(usuario: Usuario | null) {
    setEditando(usuario);
    setForm(usuario ? { ...usuario, senha: "", telefone: telefone(usuario.telefone) } : FORM_VAZIO);
    setAberto(true);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const resp = editando
      ? await atualizarUsuario(editando.id, {
          nome: form.nome.trim(),
          email: form.email.trim(),
          tipo: form.tipo,
          telefone: form.telefone.trim() || null,
          recebe_relatorio: form.recebe_relatorio,
          ativo: form.ativo,
          ...(form.senha ? { senha: form.senha } : {}),
        })
      : await criarUsuario({
          nome_usuario: form.nome_usuario.trim(),
          nome: form.nome.trim(),
          email: form.email.trim(),
          senha: form.senha,
          tipo: form.tipo,
          telefone: form.telefone.trim() || null,
          recebe_relatorio: form.recebe_relatorio,
        });
    if (resp.ok) {
      toast.success(editando ? "Funcionário atualizado." : "Funcionário cadastrado.");
      setAberto(false);
      carregar();
    } else toast.error(mensagemErro(resp.data));
  }

  async function enviarAgora() {
    setEnviando(true);
    const resp = await enviarRelatorioEstoque();
    setEnviando(false);
    if (resp.ok) toast.success(`Relatório enviado para ${resp.data.destinatarios} funcionário(s).`);
    else toast.error(mensagemErro(resp.data));
  }

  const set = <K extends keyof FormUsuario>(campo: K, valor: FormUsuario[K]) => setForm({ ...form, [campo]: valor });
  const ehVoceMesmo = editando?.id === account.usuario?.id;

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Funcionários</h1>
          <p>Quem acessa o sistema. Atendentes vendem, cuidam do estoque e do fiado; administradores veem o painel.</p>
        </div>
        <button className="btn btn-primario" onClick={() => abrir(null)}>
          <UserPlus size={18} /> Novo funcionário
        </button>
      </div>

      <div className="card">
        <div className="tabela-wrapper">
          <table className="tabela tabela-cartoes">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Usuário</th>
                <th>E-mail</th>
                <th>WhatsApp</th>
                <th>Perfil</th>
                <th>Desde</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className={u.ativo ? "" : "inativo"}>
                  <td className="principal">
                    <strong>{u.nome}</strong>
                  </td>
                  <td data-rotulo="Usuário">{u.nome_usuario}</td>
                  <td data-rotulo="E-mail">
                    <div>
                      {u.email}
                      {u.recebe_relatorio && u.ativo && <div className="texto-suave">recebe o relatório das 8h</div>}
                    </div>
                  </td>
                  <td data-rotulo="WhatsApp">
                    {u.telefone ? telefone(u.telefone) : <span className="texto-suave">—</span>}
                  </td>
                  <td data-rotulo="Perfil">
                    <span className={`badge ${u.tipo === "ADMIN" ? "badge-alerta" : ""}`}>
                      {u.tipo === "ADMIN" ? "Administrador" : "Atendente"}
                    </span>
                  </td>
                  <td data-rotulo="Desde">{u.created_at && data(u.created_at)}</td>
                  <td className="num acao">
                    <button className="btn btn-pequeno" onClick={() => abrir(u)} aria-label="Editar">
                      <PencilSimple size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {previa && (
        <div className="card">
          <div className="pagina-topo" style={{ marginBottom: "0.6rem" }}>
            <h2>
              <EnvelopeSimple size={20} weight="duotone" /> Relatório de estoque das {previa.hora_envio}h por e-mail
            </h2>
            <button
              className="btn"
              disabled={enviando || !previa.email_configurado || previa.destinatarios.length === 0}
              onClick={enviarAgora}
            >
              <PaperPlaneTilt size={18} /> {enviando ? "Enviando…" : "Enviar agora"}
            </button>
          </div>
          {!previa.email_configurado && (
            <p className="texto-perigo">
              O e-mail de envio não está configurado (EMAIL_CONTA e EMAIL_SENHA no .env da API). Nada será enviado.
            </p>
          )}
          <p className="texto-suave">
            Vai todo dia às {previa.hora_envio}h para{" "}
            {previa.destinatarios.length === 0
              ? 'ninguém ainda: edite um funcionário e marque "Recebe o relatório".'
              : previa.destinatarios.map((d) => `${d.nome} (${d.email})`).join(", ") + "."}
          </p>
          {previa.ultimo_envio && (
            <p className={previa.ultimo_envio.erro ? "texto-perigo" : "texto-suave"}>
              Último envio automático:{" "}
              {previa.ultimo_envio.enviado_em
                ? `${dataHora(previa.ultimo_envio.enviado_em)}, para ${previa.ultimo_envio.destinatarios} funcionário(s).`
                : `${previa.ultimo_envio.data.split("-").reverse().join("/")}: ${previa.ultimo_envio.erro}`}
            </p>
          )}
          <iframe
            title="Prévia do e-mail"
            sandbox=""
            srcDoc={previa.html}
            style={{
              width: "100%",
              maxWidth: 520,
              height: 420,
              marginTop: "0.6rem",
              border: "1px solid var(--cor-borda)",
              borderRadius: 8,
              background: "#fff",
            }}
          />
        </div>
      )}

      <Modal
        titulo={editando ? `Editar ${editando.nome}` : "Novo funcionário"}
        aberto={aberto}
        onFechar={() => setAberto(false)}
      >
        <form onSubmit={salvar}>
          <div className="form-grid">
            <label className="campo">
              Nome
              <input required value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </label>
            <label className="campo">
              Usuário (login)
              <input
                required
                disabled={!!editando}
                value={form.nome_usuario}
                onChange={(e) => set("nome_usuario", e.target.value)}
              />
            </label>
            <label className="campo">
              E-mail
              <input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
            </label>
            <label className="campo">
              {editando ? "Nova senha (opcional)" : "Senha"}
              <input
                type="password"
                required={!editando}
                autoComplete="new-password"
                value={form.senha}
                onChange={(e) => set("senha", e.target.value)}
              />
            </label>
            <label className="campo">
              WhatsApp
              <input
                placeholder="(91) 98888-7777"
                value={form.telefone}
                onChange={(e) => set("telefone", e.target.value)}
              />
            </label>
            <label className="campo">
              Perfil
              <select
                value={form.tipo}
                disabled={ehVoceMesmo}
                onChange={(e) => set("tipo", e.target.value as TipoUsuario)}
              >
                <option value="ATENDENTE">Atendente</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </label>
            <label className="campo-check" style={{ gridColumn: "1 / -1" }}>
              <input
                type="checkbox"
                checked={form.recebe_relatorio}
                onChange={(e) => set("recebe_relatorio", e.target.checked)}
              />
              Recebe o relatório de estoque das 8h por e-mail
            </label>
            {editando && (
              <label className="campo-check">
                <input
                  type="checkbox"
                  disabled={ehVoceMesmo}
                  checked={form.ativo}
                  onChange={(e) => set("ativo", e.target.checked)}
                />
                Ativo (pode entrar no sistema)
              </label>
            )}
          </div>
          <p className="texto-suave" style={{ marginTop: "0.8rem" }}>
            A senha precisa ter 8 caracteres, com letra maiúscula, minúscula e um caractere especial.
          </p>
          <div className="form-acoes">
            <button type="button" className="btn" onClick={() => setAberto(false)}>
              Cancelar
            </button>
            <button className="btn btn-primario">Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
