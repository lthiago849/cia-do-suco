import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { GlobalContext } from "./GlobalContext";
import Auth, { AdminOnly } from "./Auth";
import DefaultLayout from "./DefaultLayout";

import Login from "./Pages/Login/Login";
import PDV from "./Pages/PDV/PDV";
import Vendas from "./Pages/Vendas/Vendas";
import Clientes from "./Pages/Clientes/Clientes";
import ClienteDetalhe from "./Pages/Clientes/ClienteDetalhe";
import Fiado from "./Pages/Fiado/Fiado";
import Entregas from "./Pages/Entregas/Entregas";
import Estoque from "./Pages/Estoque/Estoque";
import Producao from "./Pages/Producao/Producao";
import Dashboard from "./Pages/Admin/Dashboard/Dashboard";
import Produtos from "./Pages/Admin/Produtos/Produtos";
import Ingredientes from "./Pages/Admin/Ingredientes/Ingredientes";
import Usuarios from "./Pages/Admin/Usuarios/Usuarios";
import Taxas from "./Pages/Admin/Taxas/Taxas";
import Error404Page from "./Pages/ErrorPage/Error404Page";
import Compartilhar from "./Pages/Compartilhar/Compartilhar";

export default function ProjectPagesRoutes() {
  const basename = import.meta.env.VITE_BASEPATH || "/";

  return (
    <BrowserRouter basename={basename}>
      <Toaster closeButton richColors position="top-right" toastOptions={{ style: { fontSize: "14px" } }} />
      <Routes>
        <Route path="/" element={<GlobalContext />}>
          <Route index element={<Navigate to="/pdv" replace />} />
          <Route path="login" element={<Login />} />
          <Route path="compartilhar" element={<Compartilhar />} />

          <Route element={<Auth />}>
            <Route element={<DefaultLayout />}>
              <Route path="pdv" element={<PDV />} />
              <Route path="vendas" element={<Vendas />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="clientes/:id" element={<ClienteDetalhe />} />
              <Route path="entregas" element={<Entregas />} />
              <Route path="fiado" element={<Fiado />} />
              <Route path="estoque" element={<Estoque />} />
              <Route path="producao" element={<Producao />} />

              <Route path="admin" element={<AdminOnly />}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="produtos" element={<Produtos />} />
                <Route path="ingredientes" element={<Ingredientes />} />
                <Route path="usuarios" element={<Usuarios />} />
                <Route path="taxas" element={<Taxas />} />
              </Route>

              <Route path="*" element={<Error404Page />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
