import React, { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { formatCurrency } from "../utils/formatters.js";
import * as echarts from "echarts";


const INITIAL_FORM = {
  initialAmount: "1000",
  monthlyContribution: "200",
  periodValue: "24",
  periodType: "months",
  returnRate: "0.8",
  rateType: "monthly",
};

function parseNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numeric)) return fallback;
  return numeric;
}

function normalizeInputs(form) {
  const initial = Math.max(0, parseNumber(form.initialAmount, 0));
  const monthly = Math.max(0, parseNumber(form.monthlyContribution, 0));
  const periodRaw = Math.max(0, parseNumber(form.periodValue, 0));
  const rateRaw = parseNumber(form.returnRate, 0);

  const periodMonths = form.periodType === "years" ? Math.round(periodRaw * 12) : Math.round(periodRaw);
  const monthlyRate = form.rateType === "annual"
    ? Math.pow(1 + rateRaw / 100, 1 / 12) - 1
    : rateRaw / 100;

  return {
    initial,
    monthly,
    periodMonths: Math.max(0, periodMonths),
    monthlyRate,
  };
}

function buildProjection({ initial, monthly, periodMonths, monthlyRate }) {
  const rows = [];
  let balance = initial;
  let invested = initial;

  rows.push({
    month: 0,
    balance,
    invested,
  });

  for (let month = 1; month <= periodMonths; month += 1) {
    balance = balance * (1 + monthlyRate) + monthly;
    invested += monthly;
    rows.push({
      month,
      balance,
      invested,
    });
  }

  const final = rows[rows.length - 1];
  const investedTotal = invested;
  const total = final.balance;
  const interest = total - investedTotal;

  return {
    rows,
    investedTotal,
    total,
    interest,
  };
}

/* global echarts */
function buildChartOption(rows) {
  const categories = rows.map((row) => `Mês ${row.month}`);
  const investedSeries = rows.map((row) => row.invested);
  const totalSeries = rows.map((row) => row.balance);
  const lastInvested = investedSeries[investedSeries.length - 1];
  const lastTotal = totalSeries[totalSeries.length - 1];

  return {
    backgroundColor: "transparent",
    animationDuration: 1200,
    animationEasing: "elasticOut",

    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15,23,42,0.9)",
      borderWidth: 0,
      borderRadius: 10,
      padding: [10, 14],
      textStyle: { color: "#F1F5F9", fontSize: 12.5 },
      axisPointer: {
        type: "line",
        lineStyle: { color: "#3b82f6", width: 1.5, type: "dashed" },
      },
      valueFormatter: (value) => formatCurrency(value),
    },

    legend: {
      data: ["Investido", "Investido + Juros"],
      top: 0,
      icon: "circle",
      itemGap: 18,
      textStyle: { color: "#CBD5E1", fontSize: 12.5, fontWeight: 500 },
    },

    grid: { left: 24, right: 16, top: 48, bottom: 32 },

    xAxis: {
      type: "category",
      data: categories,
      boundaryGap: false,
      axisLabel: { color: "#94A3B8", fontSize: 11 },
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.25)" } },
      axisTick: { show: false },
    },

    yAxis: {
      type: "value",
      axisLabel: {
        color: "#94A3B8",
        fontSize: 11,
        formatter: (value) => formatCurrency(value),
      },
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.12)" } },
    },

    series: [
      // 🔵 Investido (Azul)
      {
        name: "Investido",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        showSymbol: true,
        lineStyle: { width: 2.2, color: "#3b82f6" },
        itemStyle: {
          color: "#3b82f6",
          borderColor: "#0f172a",
          borderWidth: 2,
          shadowBlur: 14,
          shadowColor: "rgba(59,130,246,0.5)",
        },
        areaStyle: {
          opacity: 1,
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(59,130,246,0.35)" },
            { offset: 1, color: "rgba(59,130,246,0.05)" },
          ]),
        },
        markPoint: {
          symbol: "circle",
          symbolSize: 18,
          itemStyle: {
            color: "#3b82f6",
            shadowColor: "rgba(59,130,246,0.6)",
            shadowBlur: 20,
          },
          data: [
            {
              coord: [categories.length - 1, lastInvested],
              value: formatCurrency(lastInvested),
              label: {
                color: "#E2E8F0",
                fontSize: 11,
                formatter: (p) => p.value,
                backgroundColor: "rgba(15,23,42,0.85)",
                borderRadius: 6,
                padding: [4, 6],
              },
            },
          ],
        },
        data: investedSeries,
      },

      // 🟢 Investido + Juros (Verde)
      {
        name: "Investido + Juros",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        showSymbol: true,
        lineStyle: { width: 2.2, color: "#22c55e" },
        itemStyle: {
          color: "#22c55e",
          borderColor: "#0f172a",
          borderWidth: 2,
          shadowBlur: 18,
          shadowColor: "rgba(34,197,94,0.5)",
        },
        areaStyle: {
          opacity: 1,
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(34,197,94,0.35)" },
            { offset: 1, color: "rgba(34,197,94,0.05)" },
          ]),
        },
        markPoint: {
          symbol: "circle",
          symbolSize: 20,
          itemStyle: {
            color: "#22c55e",
            shadowColor: "rgba(34,197,94,0.6)",
            shadowBlur: 24,
          },
          data: [
            {
              coord: [categories.length - 1, lastTotal],
              value: formatCurrency(lastTotal),
              label: {
                color: "#E2E8F0",
                fontSize: 11,
                formatter: (p) => p.value,
                backgroundColor: "rgba(15,23,42,0.85)",
                borderRadius: 6,
                padding: [4, 6],
              },
            },
          ],
        },
        data: totalSeries,
      },
    ],
  };
}



export default function CompoundInterestPage() {
  const [form, setForm] = useState(INITIAL_FORM);

  const inputs = useMemo(() => normalizeInputs(form), [form]);
  const projection = useMemo(() => buildProjection(inputs), [inputs]);
  const chartOption = useMemo(() => buildChartOption(projection.rows), [projection.rows]);
  const interestColor = projection.interest >= 0
    ? "text-emerald-600 dark:text-emerald-300"
    : "text-rose-600 dark:text-rose-300";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Juros compostos</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Simule o crescimento do patrimonio combinando aporte inicial, contribuicoes mensais e rentabilidade composta.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr),minmax(0,1fr)]">
        <form className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              Valor inicial
              <input
                name="initialAmount"
                type="number"
                min="0"
                step="0.01"
                value={form.initialAmount}
                onChange={handleChange}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              Aporte mensal
              <input
                name="monthlyContribution"
                type="number"
                step="0.01"
                value={form.monthlyContribution}
                onChange={handleChange}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              Periodo
              <div className="flex gap-3">
                <input
                  name="periodValue"
                  type="number"
                  min="0"
                  step="1"
                  value={form.periodValue}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                />
                <select
                  name="periodType"
                  value={form.periodType}
                  onChange={handleChange}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                >
                  <option value="months">Meses</option>
                  <option value="years">Anos</option>
                </select>
              </div>
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              Rentabilidade
              <div className="flex gap-3">
                <input
                  name="returnRate"
                  type="number"
                  step="0.01"
                  value={form.returnRate}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                />
                <select
                  name="rateType"
                  value={form.rateType}
                  onChange={handleChange}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                >
                  <option value="monthly">% ao mes</option>
                  <option value="annual">% ao ano</option>
                </select>
              </div>
            </label>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Consideramos que o saldo rende primeiro e o aporte mensal acontece no fim de cada mes. Quando a taxa for anual, convertemos para equivalente mensal usando (1 + taxa)^(1/12) - 1.
          </p>
        </form>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Valor investido</p>
            <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrency(projection.investedTotal)}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Juros acumulados</p>
            <p className={`mt-3 text-2xl font-semibold ${interestColor}`}>
              {formatCurrency(projection.interest)}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Total projetado</p>
            <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrency(projection.total)}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Evolucao no periodo</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Linha azul representa o patrimonio com juros compostos. A linha ciano considera apenas aportes.
            </p>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Taxa mensal equivalente: {(inputs.monthlyRate * 100).toFixed(3)}%
          </div>
        </div>
        <div className="mt-6">
          <ReactECharts option={chartOption} notMerge lazyUpdate style={{ height: 360 }} />
        </div>
      </section>
    </div>
  );
}




