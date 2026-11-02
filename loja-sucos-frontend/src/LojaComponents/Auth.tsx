import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { useGlobalContext } from "./GlobalContext";
import { useFetchData } from "./Hooks/FetchData/useFetchData";

/** Só renderiza as páginas internas depois de validar o token no backend (/users/me) */
export default function Auth() {
  const { account } = useGlobalContext();
  const { getMe } = useFetchData();
  const [verificando, setVerificando] = useState(!account.usuario && !!account.loginToken);

  const { loginToken, usuario, setUsuario, logout } = account;

  useEffect(() => {
    if (!loginToken || usuario) return;

    getMe()
      .then((resp) => {
        if (resp.ok) setUsuario(resp.data);
        else logout();
      })
      .catch(() => logout())
      .finally(() => setVerificando(false));
  }, [loginToken, usuario, getMe, setUsuario, logout]);

  if (!loginToken) return <Navigate to="/login" replace />;
  if (verificando || !usuario) return null;

  return <Outlet />;
}

/** Bloqueia as páginas do painel administrativo para atendentes */
export function AdminOnly() {
  const { account } = useGlobalContext();
  if (account.usuario?.tipo !== "ADMIN") return <Navigate to="/pdv" replace />;
  return <Outlet />;
}
