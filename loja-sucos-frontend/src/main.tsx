import ReactDOM from "react-dom/client";
import App from "./App.tsx";

import "./LojaComponents/GlobalStyle.css";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

// Permite instalar o sistema no celular e recebê-lo no "Compartilhar" do WhatsApp (só no build de produção)
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
