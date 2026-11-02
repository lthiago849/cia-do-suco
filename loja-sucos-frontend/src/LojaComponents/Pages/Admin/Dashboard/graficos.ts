import * as Highcharts from "highcharts";
import HighchartsHeatmap from "highcharts/modules/heatmap";

HighchartsHeatmap(Highcharts);

/**
 * Cores por papel, fixas em todos os gráficos (a cor acompanha a medida, nunca a posição):
 * receita = azul, custo = laranja, lucro = verde-água. Paleta validada para daltonismo
 * (ΔE ≥ 9 entre os três). O verde-água tem contraste < 3:1, por isso todo gráfico tem a tabela.
 */
export const CORES = {
  receita: "#2a78d6",
  custo: "#eb6834",
  lucro: "#1baf7a",
  // Rampa sequencial (uma só cor, do claro ao escuro) para o mapa de calor
  sequencial: ["#cde2fb", "#86b6ef", "#2a78d6", "#1c5cab", "#0d366b"],
};

const TEXTO_SECUNDARIO = "#6f6a62";
const GRADE = "#eeebe5";

Highcharts.setOptions({
  lang: {
    decimalPoint: ",",
    thousandsSep: ".",
    numericSymbols: [" mil", " mi", " bi"],
    months: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
    shortMonths: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
    weekdays: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
    noData: "Sem vendas no período",
  },
  chart: {
    backgroundColor: "transparent",
    style: { fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
    spacing: [8, 4, 8, 4],
  },
  title: { text: undefined },
  credits: { enabled: false },
  exporting: { enabled: false },
  legend: {
    itemStyle: { color: TEXTO_SECUNDARIO, fontWeight: "500", fontSize: "12px" },
    symbolRadius: 2,
  },
  xAxis: {
    lineColor: GRADE,
    tickColor: GRADE,
    labels: { style: { color: TEXTO_SECUNDARIO, fontSize: "12px" } },
  },
  yAxis: {
    gridLineColor: GRADE,
    gridLineWidth: 1,
    title: { text: undefined },
    labels: { style: { color: TEXTO_SECUNDARIO, fontSize: "12px" } },
  },
  tooltip: {
    backgroundColor: "#ffffff",
    borderColor: "#e6e1d8",
    borderRadius: 8,
    shadow: { color: "rgba(0,0,0,0.08)", offsetX: 0, offsetY: 2, width: 6 },
    style: { color: "#2d2a26", fontSize: "13px" },
  },
  plotOptions: {
    series: { animation: { duration: 300 } },
    // Barras finas, cantos arredondados e 2px de respiro (borda na cor da superfície)
    column: { borderRadius: 4, borderWidth: 2, borderColor: "#ffffff", pointPadding: 0.05, groupPadding: 0.12 },
    bar: { borderRadius: 4, borderWidth: 2, borderColor: "#ffffff", pointPadding: 0.05, groupPadding: 0.08 },
  },
});

export default Highcharts;
