/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useState } from "react";
import { Outlet } from "react-router-dom";

import { Usuario } from "./Interfaces";

interface GlobalPropsInterface {
  account: {
    loginToken: string;
    setLoginToken: (token: string) => void;
    usuario: Usuario | null;
    setUsuario: React.Dispatch<React.SetStateAction<Usuario | null>>;
    logout: () => void;
  };
  getCookieString: (name: string) => string | undefined;
}

const GlobalContextProvider = createContext<GlobalPropsInterface | null>(null);

const COOKIE_TOKEN = "token";

function getCookieString(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift();
  }
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSeconds}; SameSite=Strict`;
}

export function GlobalContext() {
  const [loginToken, setLoginTokenState] = useState(getCookieString(COOKIE_TOKEN) ?? "");
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const setLoginToken = useCallback((token: string) => {
    // 12 horas, o mesmo tempo de expiração do token no backend
    setCookie(COOKIE_TOKEN, token, token ? 12 * 60 * 60 : 0);
    setLoginTokenState(token);
  }, []);

  const logout = useCallback(() => {
    setLoginToken("");
    setUsuario(null);
  }, [setLoginToken]);

  return (
    <GlobalContextProvider.Provider
      value={{
        account: { loginToken, setLoginToken, usuario, setUsuario, logout },
        getCookieString,
      }}
    >
      <Outlet />
    </GlobalContextProvider.Provider>
  );
}

export function useGlobalContext() {
  const context = useContext(GlobalContextProvider);
  if (!context) {
    throw new Error("useGlobalContext deve ser usado dentro de <GlobalContext />");
  }
  return context;
}
