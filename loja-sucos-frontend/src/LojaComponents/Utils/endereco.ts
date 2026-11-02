import { EnderecoForm } from "../Interfaces";

export const ENDERECO_VAZIO: EnderecoForm = {
  logradouro: null,
  numero: null,
  bairro: null,
  complemento: null,
  ponto_referencia: null,
  latitude: null,
  longitude: null,
};

/** Converte os campos de texto em null quando vazios, no formato esperado pela API */
export function limparEndereco(endereco: EnderecoForm): EnderecoForm {
  const texto = (v: string | null) => (v && v.trim() ? v.trim() : null);
  return {
    logradouro: texto(endereco.logradouro),
    numero: texto(endereco.numero),
    bairro: texto(endereco.bairro),
    complemento: texto(endereco.complemento),
    ponto_referencia: texto(endereco.ponto_referencia),
    latitude: endereco.latitude,
    longitude: endereco.longitude,
  };
}

export function enderecoPreenchido(endereco: EnderecoForm): boolean {
  return !!(endereco.logradouro?.trim() || endereco.ponto_referencia?.trim() || endereco.latitude !== null);
}
