import { ReactNode } from "react";

import { Periodo } from "../../Interfaces";
import { hojeISO } from "../../Utils/formatar";
import Recolhivel from "../Recolhivel/Recolhivel";

interface SeletorPeriodoProps {
  periodo: Periodo;
  onChange: (periodo: Periodo) => void;
  /** Outros filtros da página, que no celular ficam junto das datas em "Mais filtros" */
  children?: ReactNode;
  /** Algum dos outros filtros está diferente do padrão */
  filtrosAtivos?: boolean;
}

function inicioDoMes(): string {
  return hojeISO().slice(0, 8) + "01";
}

const PRESETS: { rotulo: string; periodo: () => Periodo }[] = [
  { rotulo: "Hoje", periodo: () => ({ data_inicio: hojeISO(), data_fim: hojeISO() }) },
  { rotulo: "7 dias", periodo: () => ({ data_inicio: hojeISO(-6), data_fim: hojeISO() }) },
  { rotulo: "30 dias", periodo: () => ({ data_inicio: hojeISO(-29), data_fim: hojeISO() }) },
  { rotulo: "Este mês", periodo: () => ({ data_inicio: inicioDoMes(), data_fim: hojeISO() }) },
  { rotulo: "90 dias", periodo: () => ({ data_inicio: hojeISO(-89), data_fim: hojeISO() }) },
];

export default function SeletorPeriodo({ periodo, onChange, children, filtrosAtivos = false }: SeletorPeriodoProps) {
  const presets = PRESETS.map((preset) => ({ ...preset, valor: preset.periodo() }));
  const algumPresetAtivo = presets.some(
    ({ valor }) => valor.data_inicio === periodo.data_inicio && valor.data_fim === periodo.data_fim,
  );

  return (
    <div className="filtros seletor-periodo">
      <div className="presets">
        {presets.map(({ rotulo, valor }) => {
          const ativo = valor.data_inicio === periodo.data_inicio && valor.data_fim === periodo.data_fim;
          return (
            <button
              key={rotulo}
              className={`btn btn-pequeno ${ativo ? "btn-primario" : ""}`}
              onClick={() => onChange(valor)}
            >
              {rotulo}
            </button>
          );
        })}
      </div>
      <Recolhivel rotulo={children ? "Mais filtros" : "Outro período"} destaque={!algumPresetAtivo || filtrosAtivos}>
        <label className="campo">
          De
          <input
            type="date"
            value={periodo.data_inicio}
            max={periodo.data_fim}
            onChange={(e) => e.target.value && onChange({ ...periodo, data_inicio: e.target.value })}
          />
        </label>
        <label className="campo">
          Até
          <input
            type="date"
            value={periodo.data_fim}
            min={periodo.data_inicio}
            onChange={(e) => e.target.value && onChange({ ...periodo, data_fim: e.target.value })}
          />
        </label>
        {children}
      </Recolhivel>
    </div>
  );
}
