import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ChartBar,
  CreditCard,
  CookingPot,
  Package,
  Receipt,
  ShoppingCart,
  SignOut,
  UserList,
  Users,
  Wallet,
  Orange,
  Drop,
  Moped,
  List,
  X,
} from "@phosphor-icons/react";

import { useGlobalContext } from "./GlobalContext";
import style from "./DefaultLayout.module.css";

const LINKS = [
  { to: "/pdv", rotulo: "Vender", icone: ShoppingCart },
  { to: "/entregas", rotulo: "Entregas", icone: Moped },
  { to: "/vendas", rotulo: "Vendas", icone: Receipt },
  { to: "/clientes", rotulo: "Clientes", icone: UserList },
  { to: "/fiado", rotulo: "Fiado", icone: Wallet },
  { to: "/estoque", rotulo: "Estoque", icone: Package },
  { to: "/producao", rotulo: "Produção", icone: CookingPot },
];

const LINKS_ADMIN = [
  { to: "/admin/dashboard", rotulo: "Painel", icone: ChartBar },
  { to: "/admin/produtos", rotulo: "Produtos", icone: Orange },
  { to: "/admin/ingredientes", rotulo: "Ingredientes", icone: Drop },
  { to: "/admin/taxas", rotulo: "Taxas da maquininha", icone: CreditCard },
  { to: "/admin/usuarios", rotulo: "Funcionários", icone: Users },
];

export default function DefaultLayout() {
  const { account } = useGlobalContext();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);

  // Fecha o menu ao trocar de página
  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  // Com o menu aberto (celular): Esc fecha e a página de trás não rola
  useEffect(() => {
    if (!menuAberto) return;
    const fecharComEsc = (e: KeyboardEvent) => e.key === "Escape" && setMenuAberto(false);
    window.addEventListener("keydown", fecharComEsc);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", fecharComEsc);
      document.body.style.overflow = overflowAnterior;
    };
  }, [menuAberto]);

  const usuario = account.usuario!;

  function sair() {
    account.logout();
    navigate("/login");
  }

  function renderLinks(links: typeof LINKS) {
    return links.map(({ to, rotulo, icone: Icone }) => (
      <NavLink
        key={to}
        to={to}
        onClick={() => setMenuAberto(false)}
        className={({ isActive }) => `${style.link} ${isActive ? style.linkAtivo : ""}`}
      >
        <Icone size={20} weight="duotone" />
        {rotulo}
      </NavLink>
    ));
  }

  return (
    <div className={style.container}>
      <header className={style.topoMobile}>
        <button className="btn btn-pequeno" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
          <List size={22} />
        </button>
        <span className={style.marca}>Loja de Sucos</span>
      </header>

      {menuAberto && <div className={style.fundoMenu} onClick={() => setMenuAberto(false)} aria-hidden="true" />}

      <aside className={`${style.menu} ${menuAberto ? style.menuAberto : ""}`}>
        <div className={style.marca}>
          <Orange size={26} weight="fill" color="var(--cor-primaria)" />
          Loja de Sucos
          <button
            className={`btn btn-pequeno ${style.fecharMenu}`}
            onClick={() => setMenuAberto(false)}
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className={style.nav}>
          {renderLinks(LINKS)}
          {usuario.tipo === "ADMIN" && (
            <>
              <span className={style.secao}>Administração</span>
              {renderLinks(LINKS_ADMIN)}
            </>
          )}
        </nav>

        <div className={style.usuario}>
          <div>
            <strong>{usuario.nome}</strong>
            <span>{usuario.tipo === "ADMIN" ? "Administrador" : "Atendente"}</span>
          </div>
          <button className="btn btn-pequeno" onClick={sair}>
            <SignOut size={18} /> Sair
          </button>
        </div>
      </aside>

      <main className={style.conteudo}>
        <Outlet />
      </main>
    </div>
  );
}
