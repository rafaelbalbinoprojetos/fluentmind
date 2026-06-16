import React, { useMemo } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import { RADAR_UNIVERSE } from "../data/radarUniverse.js";

function buildMockSeries(seedString) {
  const seedBase = Math.max(1, seedString.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0));
  const values = [];
  let current = 100 + (seedBase % 30);
  for (let i = 0; i < 60; i += 1) {
    const wave = Math.sin((i + seedBase) / 7) * 1.4;
    const drift = ((seedBase % 11) - 5) * 0.015;
    current = Math.max(10, current + wave + drift);
    values.push(Number(current.toFixed(2)));
  }
  return values;
}

function buildChartOption(symbol) {
  const series = buildMockSeries(symbol);
  const labels = series.map((_, index) => `D-${series.length - index}`);
  return {
    tooltip: { trigger: "axis" },
    grid: { left: 24, right: 16, top: 16, bottom: 28 },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLabel: { show: false },
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.35)" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8" },
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.15)" } },
    },
    series: [
      {
        type: "line",
        data: series,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2.5, color: "#22c55e" },
        areaStyle: { color: "rgba(34,197,94,0.12)" },
      },
    ],
  };
}

export default function RadarAssetDetailsPage() {
  const { symbol } = useParams();
  const location = useLocation();
  const stateItem = location.state?.item ?? null;
  const normalizedSymbol = decodeURIComponent(String(symbol || "")).toUpperCase();
  const universeItem = useMemo(
    () => RADAR_UNIVERSE.find((item) => item.symbol.toUpperCase() === normalizedSymbol) ?? null,
    [normalizedSymbol],
  );

  const item = stateItem ?? (universeItem
    ? {
        symbol: universeItem.symbol,
        name: universeItem.name,
        signalTitle: "Ativo em observacao no radar",
        reasons: [
          "liquidez relevante no universo monitorado",
          "movimento de preco chamou atencao no dia",
          "ativo valido para comparacao com sua carteira",
        ],
      }
    : null);

  if (!item) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">Ativo nao encontrado no radar atual.</p>
        <Link to="/radar" className="text-sm font-semibold text-temaSky hover:underline dark:text-temaEmerald">
          Voltar para o Radar do Mercado
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link to="/radar" className="text-xs font-semibold text-temaSky hover:underline dark:text-temaEmerald">
          Voltar para Radar do Mercado
        </Link>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">{item.symbol}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{item.name}</p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Grafico do ativo</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Serie ilustrativa para acompanhamento visual do movimento recente.</p>
        <div className="mt-3">
          <ReactECharts option={buildChartOption(item.symbol)} notMerge lazyUpdate style={{ height: 280, width: "100%" }} />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Por que entrou no radar</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.signalTitle || "Sinal de mercado monitorado pelo Korden."}</p>
        <div className="mt-3 space-y-1">
          {(item.reasons ?? []).slice(0, 3).map((reason, index) => (
            <p key={`${item.symbol}-reason-${index}`} className="text-xs text-gray-600 dark:text-gray-300">
              - {reason}
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-800 dark:border-sky-500/40 dark:bg-sky-900/20 dark:text-sky-200">
        Conteudo educacional. Isto nao e recomendacao de investimento.
      </section>
    </div>
  );
}

