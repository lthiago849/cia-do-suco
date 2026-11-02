import { EnderecoForm } from "../../Interfaces";
import { lerNumero } from "../../Utils/formatar";

interface FormEnderecoProps {
  valor: EnderecoForm;
  onChange: (valor: EnderecoForm) => void;
}

export default function FormEndereco({ valor, onChange }: FormEnderecoProps) {
  const set = (campo: keyof EnderecoForm, v: string) => onChange({ ...valor, [campo]: v });

  /** Aceita a localização colada do Google Maps / WhatsApp, ex.: "-1.4558, -48.5039" */
  function setLocalizacao(texto: string) {
    const partes = texto.split(/[,;\s]+/).filter(Boolean).map(lerNumero);
    if (partes.length === 2 && partes.every((n) => !Number.isNaN(n))) {
      onChange({ ...valor, latitude: partes[0], longitude: partes[1] });
    } else if (!texto.trim()) {
      onChange({ ...valor, latitude: null, longitude: null });
    }
  }

  return (
    <div className="form-grid">
      <label className="campo" style={{ gridColumn: "1 / -1" }}>
        Ponto de referência
        <textarea
          rows={2}
          placeholder='Ex.: "casa da tia Maria, portão azul, perto da igreja"'
          value={valor.ponto_referencia ?? ""}
          onChange={(e) => set("ponto_referencia", e.target.value)}
        />
      </label>
      <label className="campo">
        Rua / travessa
        <input value={valor.logradouro ?? ""} onChange={(e) => set("logradouro", e.target.value)} />
      </label>
      <label className="campo">
        Número
        <input value={valor.numero ?? ""} onChange={(e) => set("numero", e.target.value)} />
      </label>
      <label className="campo">
        Bairro
        <input value={valor.bairro ?? ""} onChange={(e) => set("bairro", e.target.value)} />
      </label>
      <label className="campo">
        Complemento
        <input value={valor.complemento ?? ""} onChange={(e) => set("complemento", e.target.value)} />
      </label>
      <label className="campo" style={{ gridColumn: "1 / -1" }}>
        Localização (latitude, longitude)
        <input
          placeholder="Cole aqui a localização que o cliente mandou, ex.: -1.455833, -48.503887"
          defaultValue={valor.latitude !== null ? `${valor.latitude}, ${valor.longitude}` : ""}
          onBlur={(e) => setLocalizacao(e.target.value)}
        />
      </label>
    </div>
  );
}
