import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Warning } from "@phosphor-icons/react";
import HighchartsReact from "highcharts-react-official";

import { mensagemErro, useFetchData } from "../../../Hooks/FetchData/useFetchData";
import {
  HorarioPico,
  Periodo,
  ProdutoRelatorio,
  ResumoRelatorio,
  VendaPorDia,
  VendaPorDiaSemana,
} from "../../../Interfaces";
import { NOMES_CATEGORIA, NOMES_FORMA_PAGAMENTO, data, hojeISO, moeda } from "../../../Utils/formatar";
import SeletorPeriodo from "../../../PagesSections/SeletorPeriodo/SeletorPeriodo";
import Highcharts, { CORES } from "./graficos";
import CardGrafico from "./CardGrafico";
import style from "./Dashboard.module.css";

interface Dados {
  resumo: ResumoRelatorio;
  produtos: ProdutoRelatorio[];
  porDia: VendaPorDia[];
  porDiaSemana: VendaPorDiaSemana[];
  horarios: HorarioPico[];
}

const DIAS_CURTOS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const TOP_PRODUTOS = 10;

function porcentagem(valor: number) {
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export default function Dashboard() {
  const api = useFetchData();
  const [periodo, setPeriodo] = useState<Periodo>({ data_inicio: hojeISO(-29), data_fim: hojeISO() });
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [vendidosSemCusto, setVendidosSemCusto] = useState(0);

  const { getProdutos, getResumo, getRelatorioProdutos, getVendasPorDia, getVendasPorDiaSemana, getHorariosPico } = api;

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    Promise.all([
      getResumo(periodo),
      getRelatorioProdutos(periodo),
      getVendasPorDia(periodo),
      getVendasPorDiaSemana(periodo),
      getHorariosPico(periodo),
    ])
      .then(([resumo, produtos, porDia, porDiaSemana, horarios]) => {
        if (!ativo) return;
        const falha = [resumo, produtos, porDia, porDiaSemana, horarios].find((r) => !r.ok);
        if (falha) {
          toast.error(mensagemErro(falha.data));
          return;
        }
        setDados({
          resumo: resumo.data,
          produtos: produtos.data,
          porDia: porDia.data,
          porDiaSemana: porDiaSemana.data,
          horarios: horarios.data,
        });
      })
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [periodo, getResumo, getRelatorioProdutos, getVendasPorDia, getVendasPorDiaSemana, getHorariosPico]);

  // Unidades vendidas com custo zero deixam o lucro maior que o real: avisa e manda corrigir em Produtos
  useEffect(() => {
    getProdutos().then((r) => {
      if (r.ok) setVendidosSemCusto(r.data.reduce((soma, p) => soma + (p.vendidos_sem_custo ?? 0), 0));
    });
  }, [getProdutos]);

  return (
    <div className="pagina">
      <div className="pagina-topo">
        <div>
          <h1>Painel</h1>
          <p>
            Vendas canceladas não entram nos números. Lucro = preço de venda + acréscimo do cartão pago pelo cliente −
            custo do produto na hora da venda − taxa da maquininha.
          </p>
        </div>
      </div>

      {vendidosSemCusto > 0 && (
        <div className="card aviso-alerta">
          <Warning size={20} weight="fill" />
          <div>
            <strong>
              {vendidosSemCusto} unidade{vendidosSemCusto === 1 ? "" : "s"} vendida{vendidosSemCusto === 1 ? "" : "s"}{" "}
              sem custo: o lucro abaixo está maior que o real.
            </strong>
            <p className="texto-suave">
              <Link to="/admin/produtos">Informe o custo desses produtos em Produtos</Link> para corrigir.
            </p>
          </div>
        </div>
      )}

      {/* Um único filtro para todos os gráficos */}
      <div className="card">
        <SeletorPeriodo periodo={periodo} onChange={setPeriodo} />
      </div>

      {dados && (
        // Mantém o resultado anterior esmaecido enquanto recarrega, sem "pular" o layout
        <div className={style.conteudo} style={{ opacity: carregando ? 0.55 : 1 }}>
          <Indicadores resumo={dados.resumo} />

          <div className={style.grade}>
            <GraficoPorDia porDia={dados.porDia} />
            <GraficoMaisVendidos produtos={dados.produtos} />
            <GraficoLucroProdutos produtos={dados.produtos} />
            <GraficoDiaSemana porDiaSemana={dados.porDiaSemana} />
            <GraficoHorarios horarios={dados.horarios} />
            <GraficoFormasPagamento resumo={dados.resumo} />
          </div>
        </div>
      )}
    </div>
  );
}

function Indicadores({ resumo }: { resumo: ResumoRelatorio }) {
  const margem = resumo.faturamento > 0 ? (resumo.lucro / resumo.faturamento) * 100 : 0;
  const itens = [
    { rotulo: "Faturamento", valor: moeda(resumo.faturamento) },
    { rotulo: "Lucro", valor: moeda(resumo.lucro), detalhe: `margem de ${porcentagem(margem)}` },
    {
      rotulo: "Vendas",
      valor: resumo.num_vendas.toLocaleString("pt-BR"),
      detalhe: `ticket médio ${moeda(resumo.ticket_medio)}`,
    },
    { rotulo: "Custo dos produtos", valor: moeda(resumo.custo) },
    {
      rotulo: "Taxas da maquininha",
      valor: moeda(resumo.taxas),
      detalhe: resumo.acrescimos > 0 ? `${moeda(resumo.acrescimos)} pagos pelos clientes` : undefined,
    },
    {
      rotulo: "Fiado a receber",
      valor: moeda(resumo.fiado_em_aberto_total),
      detalhe: `${moeda(resumo.fiado_vendido_periodo)} vendido fiado no período`,
    },
  ];

  return (
    <div className={style.indicadores}>
      {itens.map((item) => (
        <div key={item.rotulo} className={`card ${style.indicador}`}>
          <span className="texto-suave">{item.rotulo}</span>
          <strong>{item.valor}</strong>
          {item.detalhe && <span className="texto-suave">{item.detalhe}</span>}
        </div>
      ))}
    </div>
  );
}

function GraficoPorDia({ porDia }: { porDia: VendaPorDia[] }) {
  const opcoes: Highcharts.Options = {
    chart: { type: "column", height: 300 },
    xAxis: { categories: porDia.map((d) => data(d.dia).slice(0, 5)), crosshair: { color: "rgba(0,0,0,0.04)" } },
    yAxis: { labels: { formatter: ({ value }) => moeda(Number(value)) } },
    tooltip: {
      shared: true,
      formatter: function () {
        const dia = porDia[this.points?.[0]?.point.index ?? 0];
        return (
          `<b>${data(dia.dia)}</b><br/>` +
          `Faturamento: <b>${moeda(dia.faturamento)}</b><br/>` +
          `Lucro: <b>${moeda(dia.lucro)}</b><br/>` +
          `${dia.num_vendas} venda${dia.num_vendas === 1 ? "" : "s"}`
        );
      },
    },
    series: [
      { type: "column", name: "Faturamento", color: CORES.receita, data: porDia.map((d) => d.faturamento) },
      { type: "column", name: "Lucro", color: CORES.lucro, data: porDia.map((d) => d.lucro) },
    ],
  };

  return (
    <CardGrafico
      titulo="Faturamento e lucro por dia"
      className={style.largo}
      vazio={porDia.length === 0}
      grafico={<HighchartsReact highcharts={Highcharts} options={opcoes} />}
      tabela={
        <table className="tabela tabela-cartoes">
          <thead>
            <tr>
              <th>Dia</th>
              <th className="num">Vendas</th>
              <th className="num">Faturamento</th>
              <th className="num">Lucro</th>
            </tr>
          </thead>
          <tbody>
            {porDia.map((d) => (
              <tr key={d.dia}>
                <td className="principal">{data(d.dia)}</td>
                <td className="num" data-rotulo="Vendas">
                  {d.num_vendas}
                </td>
                <td className="num" data-rotulo="Faturamento">
                  {moeda(d.faturamento)}
                </td>
                <td className="num" data-rotulo="Lucro">
                  {moeda(d.lucro)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}

function TabelaProdutos({ produtos }: { produtos: ProdutoRelatorio[] }) {
  return (
    <table className="tabela tabela-cartoes">
      <thead>
        <tr>
          <th>Produto</th>
          <th className="num">Vendidos</th>
          <th className="num">Receita</th>
          <th className="num">Custo</th>
          <th className="num">Taxas</th>
          <th className="num">Lucro</th>
          <th className="num">Margem</th>
        </tr>
      </thead>
      <tbody>
        {produtos.map((p) => (
          <tr key={p.produto_id}>
            <td className="principal">
              {p.nome} <span className="texto-suave">· {NOMES_CATEGORIA[p.categoria]}</span>
            </td>
            <td className="num" data-rotulo="Vendidos">
              {p.quantidade}
            </td>
            <td className="num" data-rotulo="Receita">
              {moeda(p.receita)}
            </td>
            <td className="num" data-rotulo="Custo">
              {moeda(p.custo)}
            </td>
            <td className="num" data-rotulo="Taxas">
              {moeda(p.taxas)}
            </td>
            <td className="num" data-rotulo="Lucro">
              {moeda(p.lucro)}
            </td>
            <td className="num" data-rotulo="Margem">
              {porcentagem(p.margem)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function nomeProduto(p: ProdutoRelatorio) {
  return `${p.nome} (${NOMES_CATEGORIA[p.categoria].toLowerCase()})`;
}

function GraficoMaisVendidos({ produtos }: { produtos: ProdutoRelatorio[] }) {
  const top = produtos.slice(0, TOP_PRODUTOS);
  const opcoes: Highcharts.Options = {
    chart: { type: "bar", height: Math.max(220, top.length * 34 + 60) },
    xAxis: { categories: top.map(nomeProduto), lineWidth: 0 },
    yAxis: { allowDecimals: false },
    legend: { enabled: false },
    tooltip: {
      formatter: function () {
        const p = top[this.point.index];
        return `<b>${nomeProduto(p)}</b><br/>${p.quantidade} vendidos · ${moeda(p.receita)}`;
      },
    },
    plotOptions: {
      bar: { dataLabels: { enabled: true, style: { color: "#2d2a26", textOutline: "none", fontWeight: "600" } } },
    },
    series: [{ type: "bar", name: "Unidades vendidas", color: CORES.receita, data: top.map((p) => p.quantidade) }],
  };

  return (
    <CardGrafico
      titulo="Mais vendidos"
      descricao={`Unidades vendidas · top ${TOP_PRODUTOS}`}
      vazio={produtos.length === 0}
      grafico={<HighchartsReact highcharts={Highcharts} options={opcoes} />}
      tabela={<TabelaProdutos produtos={produtos} />}
    />
  );
}

function GraficoLucroProdutos({ produtos }: { produtos: ProdutoRelatorio[] }) {
  const top = [...produtos].sort((a, b) => b.receita - a.receita).slice(0, TOP_PRODUTOS);
  const opcoes: Highcharts.Options = {
    chart: { type: "bar", height: Math.max(240, top.length * 52 + 70) },
    xAxis: { categories: top.map(nomeProduto), lineWidth: 0 },
    yAxis: { labels: { formatter: ({ value }) => moeda(Number(value)) } },
    tooltip: {
      shared: true,
      formatter: function () {
        const p = top[this.points?.[0]?.point.index ?? 0];
        return (
          `<b>${nomeProduto(p)}</b><br/>` +
          `Receita: <b>${moeda(p.receita)}</b><br/>` +
          `Custo: <b>${moeda(p.custo)}</b><br/>` +
          (p.taxas > 0 ? `Taxas: <b>${moeda(p.taxas)}</b><br/>` : "") +
          `Lucro: <b>${moeda(p.lucro)}</b> (${porcentagem(p.margem)})`
        );
      },
    },
    series: [
      { type: "bar", name: "Receita", color: CORES.receita, data: top.map((p) => p.receita) },
      { type: "bar", name: "Custo", color: CORES.custo, data: top.map((p) => p.custo) },
      { type: "bar", name: "Lucro", color: CORES.lucro, data: top.map((p) => p.lucro) },
    ],
  };

  return (
    <CardGrafico
      titulo="Lucro × custo por produto"
      descricao="Maiores receitas do período"
      vazio={produtos.length === 0}
      grafico={<HighchartsReact highcharts={Highcharts} options={opcoes} />}
      tabela={<TabelaProdutos produtos={top} />}
    />
  );
}

function GraficoDiaSemana({ porDiaSemana }: { porDiaSemana: VendaPorDiaSemana[] }) {
  const opcoes: Highcharts.Options = {
    chart: { type: "column", height: 280 },
    xAxis: { categories: porDiaSemana.map((d) => d.nome) },
    yAxis: { labels: { formatter: ({ value }) => moeda(Number(value)) } },
    legend: { enabled: false },
    tooltip: {
      formatter: function () {
        const d = porDiaSemana[this.point.index];
        return (
          `<b>${d.nome}</b><br/>` +
          `Média por dia: <b>${moeda(d.media_faturamento)}</b><br/>` +
          `Total: ${moeda(d.faturamento)} em ${d.dias_com_venda} dia${d.dias_com_venda === 1 ? "" : "s"}<br/>` +
          `${d.num_vendas} venda${d.num_vendas === 1 ? "" : "s"}`
        );
      },
    },
    series: [
      {
        type: "column",
        name: "Faturamento médio",
        color: CORES.receita,
        data: porDiaSemana.map((d) => d.media_faturamento),
      },
    ],
  };

  return (
    <CardGrafico
      titulo="Qual dia vende mais"
      descricao="Faturamento médio por dia da semana"
      vazio={porDiaSemana.every((d) => d.num_vendas === 0)}
      grafico={<HighchartsReact highcharts={Highcharts} options={opcoes} />}
      tabela={
        <table className="tabela tabela-cartoes">
          <thead>
            <tr>
              <th>Dia</th>
              <th className="num">Vendas</th>
              <th className="num">Total</th>
              <th className="num">Média por dia</th>
            </tr>
          </thead>
          <tbody>
            {porDiaSemana.map((d) => (
              <tr key={d.dia_semana}>
                <td className="principal">{d.nome}</td>
                <td className="num" data-rotulo="Vendas">
                  {d.num_vendas}
                </td>
                <td className="num" data-rotulo="Total">
                  {moeda(d.faturamento)}
                </td>
                <td className="num" data-rotulo="Média por dia">
                  {moeda(d.media_faturamento)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}

function GraficoHorarios({ horarios }: { horarios: HorarioPico[] }) {
  // Mostra só a faixa de horas com venda (com pelo menos 7h–20h), preenchendo as células vazias com zero
  const horas = horarios.map((h) => h.hora);
  const primeira = Math.min(7, ...horas);
  const ultima = Math.max(20, ...horas);
  const faixa = Array.from({ length: ultima - primeira + 1 }, (_, i) => primeira + i);
  const porCelula = new Map(horarios.map((h) => [`${h.dia_semana}-${h.hora}`, h]));

  const pontos = faixa.flatMap((hora, x) =>
    DIAS_CURTOS.map((_, y) => [x, y, porCelula.get(`${y + 1}-${hora}`)?.num_vendas ?? 0]),
  );

  const opcoes: Highcharts.Options = {
    chart: { type: "heatmap", height: 320 },
    xAxis: { categories: faixa.map((h) => `${h}h`) },
    yAxis: { categories: DIAS_CURTOS, reversed: true, gridLineWidth: 0 },
    colorAxis: {
      min: 0,
      stops: CORES.sequencial.map((cor, i, lista) => [i / (lista.length - 1), cor] as [number, string]),
    },
    legend: { align: "right", layout: "vertical", verticalAlign: "middle", symbolHeight: 200 },
    tooltip: {
      formatter: function () {
        const hora = faixa[this.point.x];
        const dia = DIAS_CURTOS[this.point.y ?? 0];
        const celula = porCelula.get(`${(this.point.y ?? 0) + 1}-${hora}`);
        return `<b>${dia}, ${hora}h–${hora + 1}h</b><br/>${celula?.num_vendas ?? 0} vendas · ${moeda(celula?.faturamento ?? 0)}`;
      },
    },
    series: [{ type: "heatmap", name: "Vendas", borderWidth: 2, borderColor: "#ffffff", data: pontos }],
  };

  const ordenados = [...horarios].sort((a, b) => b.num_vendas - a.num_vendas);

  return (
    <CardGrafico
      titulo="Horários de pico"
      descricao="Número de vendas por dia da semana e hora"
      className={style.largo}
      vazio={horarios.length === 0}
      grafico={<HighchartsReact highcharts={Highcharts} options={opcoes} />}
      tabela={
        <table className="tabela tabela-cartoes">
          <thead>
            <tr>
              <th>Dia</th>
              <th>Horário</th>
              <th className="num">Vendas</th>
              <th className="num">Faturamento</th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((h) => (
              <tr key={`${h.dia_semana}-${h.hora}`}>
                <td className="principal">{DIAS_CURTOS[h.dia_semana - 1]}</td>
                <td data-rotulo="Horário">
                  {h.hora}h–{h.hora + 1}h
                </td>
                <td className="num" data-rotulo="Vendas">
                  {h.num_vendas}
                </td>
                <td className="num" data-rotulo="Faturamento">
                  {moeda(h.faturamento)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}

function GraficoFormasPagamento({ resumo }: { resumo: ResumoRelatorio }) {
  const formas = resumo.por_forma_pagamento;
  const opcoes: Highcharts.Options = {
    chart: { type: "bar", height: Math.max(200, formas.length * 40 + 50) },
    xAxis: { categories: formas.map((f) => NOMES_FORMA_PAGAMENTO[f.forma_pagamento]), lineWidth: 0 },
    yAxis: { labels: { formatter: ({ value }) => moeda(Number(value)) } },
    legend: { enabled: false },
    tooltip: {
      formatter: function () {
        const f = formas[this.point.index];
        return `<b>${NOMES_FORMA_PAGAMENTO[f.forma_pagamento]}</b><br/>${moeda(f.total)} · ${f.quantidade} venda${f.quantidade === 1 ? "" : "s"}`;
      },
    },
    plotOptions: {
      bar: {
        dataLabels: {
          enabled: true,
          formatter: function () {
            return porcentagem(formas[this.point.index].percentual);
          },
          style: { color: "#2d2a26", textOutline: "none", fontWeight: "600" },
        },
      },
    },
    series: [{ type: "bar", name: "Faturamento", color: CORES.receita, data: formas.map((f) => f.total) }],
  };

  return (
    <CardGrafico
      titulo="Formas de pagamento"
      descricao="Participação no faturamento"
      vazio={formas.length === 0}
      grafico={<HighchartsReact highcharts={Highcharts} options={opcoes} />}
      tabela={
        <table className="tabela tabela-cartoes">
          <thead>
            <tr>
              <th>Forma</th>
              <th className="num">Vendas</th>
              <th className="num">Total</th>
              <th className="num">%</th>
              <th className="num">Taxas</th>
            </tr>
          </thead>
          <tbody>
            {formas.map((f) => (
              <tr key={f.forma_pagamento}>
                <td className="principal">{NOMES_FORMA_PAGAMENTO[f.forma_pagamento]}</td>
                <td className="num" data-rotulo="Vendas">
                  {f.quantidade}
                </td>
                <td className="num" data-rotulo="Total">
                  {moeda(f.total)}
                </td>
                <td className="num" data-rotulo="%">
                  {porcentagem(f.percentual)}
                </td>
                <td className="num" data-rotulo="Taxas">
                  {moeda(f.taxas)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}
