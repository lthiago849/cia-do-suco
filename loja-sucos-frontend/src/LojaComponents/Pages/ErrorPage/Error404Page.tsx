import { Link } from "react-router-dom";

export default function Error404Page() {
  return (
    <div className="card vazio">
      <h1>Página não encontrada</h1>
      <p style={{ margin: "0.8rem 0 1.2rem" }}>O endereço acessado não existe.</p>
      <Link className="btn btn-primario" to="/pdv">
        Voltar para as vendas
      </Link>
    </div>
  );
}
