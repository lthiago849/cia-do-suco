import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Orange } from "@phosphor-icons/react";

import { useGlobalContext } from "../../GlobalContext";
import { mensagemErro, useFetchData } from "../../Hooks/FetchData/useFetchData";
import { temMensagemCompartilhada } from "../../Utils/compartilhar";
import style from "./Login.module.css";

export default function Login() {
  const { account } = useGlobalContext();
  const { login } = useFetchData();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Com token salvo, o Auth valida no backend e devolve para cá se tiver expirado
  // Veio do "Compartilhar" do WhatsApp sem estar logado: depois do login, vai direto para o pedido
  const destino = temMensagemCompartilhada() ? "/entregas" : "/pdv";
  if (account.loginToken) return <Navigate to={destino} replace />;

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const resp = await login(usuario.trim(), senha);
      if (!resp.ok) {
        toast.error(mensagemErro(resp.data));
        return;
      }
      account.setUsuario(null);
      account.setLoginToken(resp.data.access_token);
      navigate(destino);
    } catch {
      toast.error("Não foi possível conectar ao servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={style.fundo}>
      <form className={style.card} onSubmit={entrar}>
        <div className={style.marca}>
          <Orange size={40} weight="fill" color="var(--cor-primaria)" />
          <h1>Loja de Sucos</h1>
          <p className="texto-suave">Acesso dos funcionários</p>
        </div>

        <label className="campo">
          Usuário
          <input autoFocus autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
        </label>
        <label className="campo">
          Senha
          <input
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>

        <button className="btn btn-primario btn-grande" disabled={enviando || !usuario || !senha}>
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
