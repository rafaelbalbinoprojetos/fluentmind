import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import { listPriceHistory } from "../services/priceHistory.js";
import { getPortfolioRentability, listPortfolioPositions, deletePortfolioPosition } from "../services/portfolio.js";
import { listRecentPortfolioSnapshots, upsertPortfolioSnapshot } from "../services/kordenPortfolioSnapshots.js";
import { getAssetBySymbol, upsertAsset } from "../services/assets.js";
import { formatCurrency } from "../utils/formatters.js";
import { ASSET_TYPES } from "../utils/constants.js";

// Define uma base de API opcional para ambientes locais que nao tem proxy de serverless.
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const DATE_FORMATTER_FULL = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const BASE_CURRENCY = String(import.meta.env.VITE_BASE_CURRENCY || "BRL").toUpperCase();
const CONSOLIDATED_CURRENCY = "BRL";
const QUOTE_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const FX_RATES = (() => {
  const raw = import.meta.env.VITE_FX_RATES;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [String(key).toUpperCase(), Number(value)]),
      );
    }
  } catch (error) {
    console.warn("VITE_FX_RATES invalido:", error);
  }
  return null;
})();

function normalizeAssetSymbol(value) {
  const trimmed = (value ?? "").trim().toUpperCase();
  if (!trimmed) return "";
  if (!trimmed.includes(".") && /^[A-Z]{4}\d{1,2}$/.test(trimmed)) {
    return `${trimmed}.SA`;
  }
  return trimmed;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "0,00%";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatCurrencyOrDash(value, currency, hasEntries) {
  if (!hasEntries) return "—";
  if (!Number.isFinite(value)) return "—";
  return formatCurrency(value, { currency });
}

function buildHistoryOption(history = [], symbol = "", currency = "BRL") {
  const categories = history.map((point) => DATE_FORMATTER.format(new Date(point.data_registro)));
  const values = history.map((point) => Number(point.preco));

  return {
    tooltip: {
      trigger: "axis",
      valueFormatter: (val) => formatCurrency(val, { currency }),
    },
    grid: { left: 24, right: 12, top: 32, bottom: 28 },
    xAxis: {
      type: "category",
      data: categories,
      boundaryGap: false,
      axisLabel: { color: "#9CA3AF" },
      axisLine: { lineStyle: { color: "rgba(148,163,184,0.4)" } },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "#9CA3AF",
        formatter: (val) => formatCurrency(val, { currency }),
      },
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.15)" } },
    },
    series: [
      {
        name: symbol,
        data: values,
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3, color: "#22d3ee" },
        areaStyle: { opacity: 0.15, color: "#22d3ee" },
      },
    ],
  };
}

function buildAllocationOption(allocation = []) {
  return {
    tooltip: {
      trigger: "item",
      formatter: ({ name, value, percent }) => `${name}: ${formatCurrency(value)} (${percent.toFixed(1)}%)`,
    },
    legend: {
      orient: "horizontal",
      top: "bottom",
      left: "center",
      textStyle: { color: "#94A3B8", fontSize: 12 },
    },
    series: [
      {
        name: "Distribuicao",
        type: "pie",
        radius: ["40%", "70%"],
        avoidLabelOverlap: false,
        label: {
          show: true,
          formatter: ({ value, percent }) => `${formatCurrency(value)} (${percent.toFixed(1)}%)`,
          fontSize: 11,
          color: "#475569",
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: "bold",
          },
        },
        labelLine: { show: true, length: 12, length2: 8 },
        data: allocation.map((entry) => ({
          name: entry.label ?? entry.type,
          value: entry.totalCurrent,
        })),
      },
    ],
  };
}

function SummaryCard({ title, value, helper, accent }) {
  return (
    <div
      className={`rounded-2xl border p-5 transition shadow-sm dark:border-gray-800 ${
        accent ? "border-temaSky/30 bg-temaSky/5 dark:border-temaEmerald/30 dark:bg-temaEmerald/10" : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">{title}</p>
      <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      {helper ? <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{helper}</p> : null}
    </div>
  );
}

function formatSignedPercent(value, decimals = 2) {
  if (!Number.isFinite(value)) return "0,00%";
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

function resolvePortfolioClass(type) {
  const normalized = String(type ?? "").toLowerCase();
  if (normalized === "renda_fixa") return "Renda fixa";
  if (normalized === "etf" || normalized === "fundos") return "ETF";
  if (normalized === "cripto" || normalized === "criptomoedas") return "Cripto";
  if (normalized === "acao" || normalized === "renda_variavel") return "Acoes";
  return "Acoes";
}

function riskBadgeByScore(score) {
  if (score >= 67) return { perfil: "Agressivo", badge: "RISCO" };
  if (score >= 34) return { perfil: "Moderado", badge: "ATENCAO" };
  return { perfil: "Conservador", badge: "OK" };
}

function toLocalIsoDate(date = new Date()) {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
}

function resolveChangesBannerTone(tone) {
  if (tone === "risk") {
    return {
      container: "border-rose-300 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-900/20",
      title: "text-rose-800 dark:text-rose-100",
      subtitle: "text-rose-700/90 dark:text-rose-200",
      badge: "border-rose-300 bg-white text-rose-700 dark:border-rose-400/50 dark:bg-rose-900/50 dark:text-rose-200",
      button: "bg-rose-600 hover:bg-rose-700 text-white",
    };
  }
  if (tone === "attention") {
    return {
      container: "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-900/20",
      title: "text-amber-900 dark:text-amber-100",
      subtitle: "text-amber-800/90 dark:text-amber-200",
      badge: "border-amber-300 bg-white text-amber-700 dark:border-amber-400/50 dark:bg-amber-900/50 dark:text-amber-200",
      button: "bg-amber-600 hover:bg-amber-700 text-white",
    };
  }
  if (tone === "positive") {
    return {
      container: "border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-900/20",
      title: "text-emerald-900 dark:text-emerald-100",
      subtitle: "text-emerald-800/90 dark:text-emerald-200",
      badge: "border-emerald-300 bg-white text-emerald-700 dark:border-emerald-400/50 dark:bg-emerald-900/50 dark:text-emerald-200",
      button: "bg-emerald-600 hover:bg-emerald-700 text-white",
    };
  }
  return {
    container: "border-sky-300 bg-sky-50 dark:border-sky-500/40 dark:bg-sky-900/20",
    title: "text-sky-900 dark:text-sky-100",
    subtitle: "text-sky-800/90 dark:text-sky-200",
    badge: "border-sky-300 bg-white text-sky-700 dark:border-sky-400/50 dark:bg-sky-900/50 dark:text-sky-200",
    button: "bg-sky-600 hover:bg-sky-700 text-white",
  };
}

function getDailyChange(row) {
  const candidates = [
    row?.variacao_percentual,
    row?.variacaoPercentual,
    row?.variacao_diaria,
    row?.variacaoDiaria,
    row?.dailyChange,
  ];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }

  const last = Number(row?.ultimo_preco ?? row?.currentPrice);
  const prev = Number(row?.preco_anterior ?? row?.regularMarketPreviousClose);
  if (Number.isFinite(last) && Number.isFinite(prev) && prev !== 0) {
    return ((last - prev) / prev) * 100;
  }

  return null;
}

export default function InvestmentsPage() {
  const { user, loading: authLoading, subscription } = useAuth();
  const navigate = useNavigate();
  const [rentability, setRentability] = useState([]);
  const [positions, setPositions] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [fxRates, setFxRates] = useState(null);
  const [fxUpdatedAt, setFxUpdatedAt] = useState(null);
  const [marketRates, setMarketRates] = useState({
    usdBrl: null,
    eurBrl: null,
    btcBrl: null,
    updatedAt: null,
    sourceFx: null,
    sourceBtc: null,
    btcSymbol: null,
  });
  const quoteRefreshRef = useRef(new Map());
  const unsupportedSymbolsRef = useRef(new Set());
  const snapshotSyncKeyRef = useRef("");
  const analysisSectionRef = useRef(null);
  const [recentChanges, setRecentChanges] = useState({
    loading: false,
    tone: "info",
    title: "Analisando mudancas da carteira...",
    subtitle: "Assim que terminar, mostro o principal evento desde sua ultima abertura.",
    baselineDate: null,
  });

  const { hasPremiumAccess = false, canStartTrial = true } = subscription ?? {};


  useEffect(() => {
    quoteRefreshRef.current = new Map();
    unsupportedSymbolsRef.current = new Set();
    snapshotSyncKeyRef.current = "";
    setRecentChanges({
      loading: false,
      tone: "info",
      title: "Analisando mudancas da carteira...",
      subtitle: "Assim que terminar, mostro o principal evento desde sua ultima abertura.",
      baselineDate: null,
    });
  }, [user?.id]);
  const loadPortfolio = useCallback(async () => {
    if (!user) {
      setRentability([]);
      setPositions([]);
      setFetching(false);
      setError(null);
      return;
    }

    setFetching(true);
    setError(null);
    console.log("[portfolio] carregando carteira e rentabilidade...");
    try {
      const [rentData, portfolioItems] = await Promise.all([
        getPortfolioRentability({ userId: user.id }),
        listPortfolioPositions({ userId: user.id }),
      ]);
      console.log("[portfolio] carregado", {
        rentabilidade: rentData?.length ?? 0,
        posicoes: portfolioItems?.length ?? 0,
      });
      setRentability(rentData ?? []);
      setPositions(portfolioItems ?? []);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError);
      toast.error(loadError.message || "Nao foi possivel carregar sua carteira.");
    } finally {
      console.log("[portfolio] finalizado carregamento");
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    loadPortfolio();
  }, [authLoading, loadPortfolio, refreshToken]);

  useEffect(() => {
    if (!user || fetching) return;

    const controller = new AbortController();
    const fxEndpoint = API_BASE ? `${API_BASE}/api/fx?symbols=USDBRL,EURBRL` : "/api/fx?symbols=USDBRL,EURBRL";
    fetch(fxEndpoint, { signal: controller.signal })
      .then((response) => response.json().catch(() => ({})).then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) return;
        const usd = Number(data?.rates?.USDBRL ?? null);
        const eur = Number(data?.rates?.EURBRL ?? null);
        if (Number.isFinite(usd) || Number.isFinite(eur)) {
          setFxRates({
            BRL: 1,
            USD: Number.isFinite(usd) ? usd : null,
            EUR: Number.isFinite(eur) ? eur : null,
          });
          setFxUpdatedAt(data?.updatedAt ?? null);
        }
      })
      .catch((fxError) => {
        if (fxError?.name !== "AbortError") {
          console.warn("[fx] falha ao buscar cotacoes:", fxError?.message || fxError);
        }
      });

    return () => {
      controller.abort();
    };
  }, [fetching, user, refreshToken]);

  useEffect(() => {
    const controller = new AbortController();
    const marketEndpoint = API_BASE ? `${API_BASE}/api/market` : "/api/market";
    fetch(marketEndpoint, { signal: controller.signal })
      .then((response) => response.json().catch(() => ({})).then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) return;
        setMarketRates({
          usdBrl: Number(data?.rates?.USDBRL ?? null),
          eurBrl: Number(data?.rates?.EURBRL ?? null),
          btcBrl: Number(data?.rates?.BTCBRL ?? null),
          updatedAt: data?.updatedAt ?? null,
          sourceFx: data?.source?.fx ?? null,
          sourceBtc: data?.source?.btc ?? null,
          btcSymbol: data?.source?.btcSymbol ?? null,
        });
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          console.warn("[market] falha ao buscar cotacoes:", error?.message || error);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!hasPremiumAccess || !selectedSymbol) {
      setHistory([]);
      console.log("[history] nao buscando historico", { hasPremiumAccess, selectedSymbol });
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);
    console.log("[history] buscando", selectedSymbol);
    listPriceHistory({ symbol: selectedSymbol, limit: 120 })
      .then((data) => {
        console.log("[history] recebido", { symbol: selectedSymbol, pontos: data?.length ?? 0 });
        if (!cancelled) setHistory(data);
      })
      .catch((historyError) => {
        console.error(historyError);
        if (!cancelled) {
          toast.error("Nao foi possivel carregar o historico de precos.");
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSymbol, hasPremiumAccess]);

  useEffect(() => {
    if (!selectedSymbol && rentability.length > 0) {
      setSelectedSymbol(normalizeAssetSymbol(rentability[0].ativo_symbol));
    }
  }, [rentability, selectedSymbol]);
  useEffect(() => {
    quoteRefreshRef.current = new Map(
      [...quoteRefreshRef.current.entries()].filter(([symbol]) => {
        const existsInPositions = positions.some((position) => normalizeAssetSymbol(position.ativo_symbol) === symbol);
        return existsInPositions;
      }),
    );
    unsupportedSymbolsRef.current = new Set(
      [...unsupportedSymbolsRef.current].filter((symbol) =>
        positions.some((position) => normalizeAssetSymbol(position.ativo_symbol) === symbol),
      ),
    );
  }, [rentability, positions]);

  useEffect(() => {
    if (!user || fetching) {
      return;
    }

    // Atualiza cotacoes periodicamente para manter Dia % e preço atual consistentes.
    const positionSymbols = positions.map((position) => normalizeAssetSymbol(position.ativo_symbol)).filter(Boolean);
    const uniqueSymbols = [...new Set(positionSymbols)];
    const now = Date.now();
    const pending = uniqueSymbols.filter(
      (symbol) => {
        if (unsupportedSymbolsRef.current.has(symbol)) return false;
        const lastSyncedAt = Number(quoteRefreshRef.current.get(symbol) ?? 0);
        return !Number.isFinite(lastSyncedAt) || now - lastSyncedAt >= QUOTE_REFRESH_INTERVAL_MS;
      },
    );

    if (!pending.length) {
      return;
    }

    const nextSyncMap = new Map(quoteRefreshRef.current);
    pending.forEach((symbol) => nextSyncMap.set(symbol, now));
    quoteRefreshRef.current = nextSyncMap;

    fetch(API_BASE ? `${API_BASE}/api/investments/update-quotes` : "/api/investments/update-quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: pending }),
    })
      .then((response) => response.json().catch(() => ({})).then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          throw new Error(data?.error || "Update quotes failed");
        }
        console.log("[quotes] resposta", data);

        if (Array.isArray(data?.unauthorizedSymbols) && data.unauthorizedSymbols.length > 0) {
          const normalized = data.unauthorizedSymbols.map((symbol) => normalizeAssetSymbol(symbol));
          const newlyUnsupported = normalized.filter((symbol) => !unsupportedSymbolsRef.current.has(symbol));
          normalized.forEach((symbol) => {
            unsupportedSymbolsRef.current.add(symbol);
            quoteRefreshRef.current.delete(symbol);
          });
          if (newlyUnsupported.length > 0) {
            toast.error(
              "Nao foi possivel atualizar a cotacao automaticamente. Verifique limite/credenciais do brapi.dev ou atualize manualmente.",
            );
          }
        }

        if ((data?.updated ?? 0) > 0 || (data?.history ?? 0) > 0) {
          loadPortfolio();
        }
      })
      .catch((updateError) => {
        console.warn("Nao foi possivel sincronizar cotacoes imediatamente:", updateError);
      });
  }, [fetching, rentability, positions, user, loadPortfolio]);

  const mergedRows = useMemo(() => {
    const rentabilityBySymbol = new Map(rentability.map((item) => [normalizeAssetSymbol(item.ativo_symbol), item]));
    return positions
      .map((position) => {
        const normalizedSymbol = normalizeAssetSymbol(position.ativo_symbol);
        const rentRow = rentabilityBySymbol.get(normalizedSymbol);
        const quantity = Number(position.quantidade ?? 0);
        const averagePrice = Number(position.preco_medio ?? 0);
        const investedTotal = quantity * averagePrice;
        const currentPrice = rentRow?.ultimo_preco ?? averagePrice;
        const currentTotal = quantity * currentPrice;
        const profit = rentRow?.lucro_total ?? currentTotal - investedTotal;
        const rentPercent =
          rentRow?.rentabilidade_percentual ?? (investedTotal > 0 ? ((currentTotal - investedTotal) / investedTotal) * 100 : 0);
        const dailyChange = getDailyChange(rentRow);
        return {
          symbol: normalizedSymbol || position.ativo_symbol,
          rawSymbol: position.ativo_symbol,
          displaySymbol: normalizedSymbol || position.ativo_symbol,
          quantity,
          averagePrice,
          investedTotal,
          currentPrice,
          currentTotal,
          profit,
          rentPercent,
          type: position.tipo,
          origin: position.origem,
          notes: position.observacoes,
          currency: rentRow?.moeda ?? position.moeda ?? "BRL",
          lastUpdate: rentRow?.atualizado_em,
          dailyChange,
          name: rentRow?.nome ?? position.nome ?? normalizedSymbol,
        };
      })
      .sort((a, b) => b.currentTotal - a.currentTotal);
  }, [positions, rentability]);

  const positionBySymbol = useMemo(() => new Map(positions.map((position) => [position.ativo_symbol, position])), [positions]);

  const consolidatedRates = useMemo(() => {
    const rates = fxRates || FX_RATES;
    return {
      BRL: 1,
      USD: Number.isFinite(marketRates.usdBrl) ? marketRates.usdBrl : rates?.USD,
      EUR: Number.isFinite(marketRates.eurBrl) ? marketRates.eurBrl : rates?.EUR,
    };
  }, [fxRates, marketRates]);

  const consolidatedTotals = useMemo(() => {
    if (!mergedRows.length) {
      return {
        totalInvested: 0,
        totalCurrent: 0,
        profit: 0,
        rentabilityPercent: 0,
        dailyChange: 0,
      };
    }

    let invested = 0;
    let current = 0;
    let weightedDaily = 0;

    mergedRows.forEach((row) => {
      const currency = String(row.currency ?? "BRL").toUpperCase();
      const resolvedRate = consolidatedRates[currency];
      const rate = Number.isFinite(resolvedRate) ? resolvedRate : 1;
      const investedBrl = row.investedTotal * rate;
      const currentBrl = row.currentTotal * rate;
      invested += investedBrl;
      current += currentBrl;
      const change = Number(row.dailyChange ?? 0);
      weightedDaily += Number.isFinite(change) ? change * currentBrl : 0;
    });

    const profit = current - invested;
    const rentabilityPercent = invested > 0 ? (profit / invested) * 100 : 0;
    const dailyChange = current > 0 ? weightedDaily / current : 0;

    return {
      totalInvested: invested,
      totalCurrent: current,
      profit,
      rentabilityPercent,
      dailyChange,
    };
  }, [mergedRows, consolidatedRates]);

  const investedByCurrency = useMemo(() => {
    const result = {
      BRL: { total: 0, count: 0 },
      USD: { total: 0, count: 0 },
      EUR: { total: 0, count: 0 },
    };
    mergedRows.forEach((row) => {
      const currency = String(row.currency ?? "BRL").toUpperCase();
      const invested = Number(row.investedTotal ?? 0);
      if (!Number.isFinite(invested)) return;
      if (currency === "BRL" || currency === "USD" || currency === "EUR") {
        result[currency].total += invested;
        result[currency].count += 1;
      }
    });
    const totalAll = Object.values(result).reduce((acc, entry) => acc + entry.total, 0);
    const percentages = {
      BRL: totalAll > 0 ? (result.BRL.total / totalAll) * 100 : 0,
      USD: totalAll > 0 ? (result.USD.total / totalAll) * 100 : 0,
      EUR: totalAll > 0 ? (result.EUR.total / totalAll) * 100 : 0,
    };
    return { stats: result, totalAll, percentages };
  }, [mergedRows]);

  const fxHelpers = useMemo(() => {
    const rates = fxRates || FX_RATES;
    if (!rates) return { USD: null, EUR: null };
    return {
      USD: Number.isFinite(rates.USD) ? rates.USD : null,
      EUR: Number.isFinite(rates.EUR) ? rates.EUR : null,
    };
  }, [fxRates]);

  const allocation = useMemo(() => {
    if (!mergedRows.length) return [];
    const group = new Map();
    mergedRows.forEach((row) => {
      const type = row.type ?? "outro";
      const currency = String(row.currency ?? "BRL").toUpperCase();
      const resolvedRate = consolidatedRates[currency];
      const rate = Number.isFinite(resolvedRate) ? resolvedRate : 1;
      const convertedTotal = row.currentTotal * rate;
      if (!group.has(type)) {
        group.set(type, { type, totalCurrent: 0 });
      }
      group.get(type).totalCurrent += convertedTotal;
    });
    const labels = Object.fromEntries(ASSET_TYPES.map((item) => [item.value, item.label]));
    return Array.from(group.values())
      .map((entry) => ({
        ...entry,
        label: labels[entry.type] ?? entry.type,
      }))
      .sort((a, b) => b.totalCurrent - a.totalCurrent);
  }, [mergedRows, consolidatedRates]);

  const allocationByCurrency = useMemo(() => {
    if (!mergedRows.length) return [];
    const ratesFallback = fxRates || FX_RATES;
    const rates = {
      BRL: 1,
      USD: Number.isFinite(marketRates.usdBrl) ? marketRates.usdBrl : ratesFallback?.USD,
      EUR: Number.isFinite(marketRates.eurBrl) ? marketRates.eurBrl : ratesFallback?.EUR,
    };
    const group = new Map();
    mergedRows.forEach((row) => {
      const type = (row.type ?? "outro").toLowerCase();
      const currency = String(row.currency ?? "BRL").toUpperCase();
      const key = type === "cripto" ? "CRIPTO" : currency;
      const rate = rates[currency] ?? 1;
      const convertedTotal = Number.isFinite(rate) ? row.currentTotal * rate : row.currentTotal;
      if (!group.has(key)) {
        group.set(key, { label: key, totalCurrent: 0 });
      }
      group.get(key).totalCurrent += convertedTotal;
    });
    return Array.from(group.values()).sort((a, b) => b.totalCurrent - a.totalCurrent);
  }, [mergedRows, marketRates, fxRates]);

  const portfolioInsights = useMemo(() => {
    const totalCurrent = Number(consolidatedTotals.totalCurrent ?? 0);
    const totalInvested = Number(consolidatedTotals.totalInvested ?? 0);
    const totalProfit = Number(consolidatedTotals.profit ?? 0);
    const totalProfitPct = Number(consolidatedTotals.rentabilityPercent ?? 0);
    const dailyVariationPct = Number(consolidatedTotals.dailyChange ?? 0);
    const monitoredAssets = mergedRows.length;

    const classRows = allocation.map((entry) => {
      const classe = resolvePortfolioClass(entry.type);
      const valorBrl = Number(entry.totalCurrent ?? 0);
      const pct = totalCurrent > 0 ? (valorBrl / totalCurrent) * 100 : 0;
      return { classe, valorBrl, pct };
    });
    const classMap = classRows.reduce((acc, current) => {
      if (!acc[current.classe]) {
        acc[current.classe] = { valorBrl: 0, pct: 0 };
      }
      acc[current.classe].valorBrl += current.valorBrl;
      acc[current.classe].pct += current.pct;
      return acc;
    }, {});

    const currencyRows = allocationByCurrency.map((entry) => {
      const moeda = String(entry.label ?? "").toUpperCase();
      const valorBrl = Number(entry.totalCurrent ?? 0);
      const pct = totalCurrent > 0 ? (valorBrl / totalCurrent) * 100 : 0;
      return { moeda, valorBrl, pct };
    });

    const riskWeights = {
      "Renda fixa": 10,
      ETF: 35,
      Acoes: 65,
      Cripto: 90,
    };
    const riskScore = classRows.reduce((acc, row) => acc + (row.pct * (riskWeights[row.classe] ?? 65)) / 100, 0);
    const riskProfile = riskBadgeByScore(riskScore);

    const positionsInBrl = mergedRows
      .map((row) => {
        const currency = String(row.currency ?? "BRL").toUpperCase();
        const rate = Number.isFinite(consolidatedRates[currency]) ? consolidatedRates[currency] : 1;
        return {
          symbol: row.symbol,
          name: row.name ?? row.symbol,
          currentBrl: Number(row.currentTotal ?? 0) * rate,
          rentPct: Number(row.rentPercent ?? 0),
          profitBrl: Number(row.profit ?? 0) * rate,
        };
      })
      .filter((row) => Number.isFinite(row.currentBrl) && row.currentBrl > 0);

    const sortedByCurrent = [...positionsInBrl].sort((a, b) => b.currentBrl - a.currentBrl);
    const mainPosition = sortedByCurrent[0] ?? null;
    const mainPositionPct = totalCurrent > 0 ? ((mainPosition?.currentBrl ?? 0) / totalCurrent) * 100 : 0;
    const top5Total = sortedByCurrent.slice(0, 5).reduce((acc, row) => acc + row.currentBrl, 0);
    const top5Pct = totalCurrent > 0 ? (top5Total / totalCurrent) * 100 : 0;

    const topWinners = [...positionsInBrl]
      .filter((row) => Number.isFinite(row.rentPct))
      .sort((a, b) => b.rentPct - a.rentPct)
      .slice(0, 3);
    const topDetractors = [...positionsInBrl]
      .filter((row) => Number.isFinite(row.rentPct))
      .sort((a, b) => a.rentPct - b.rentPct)
      .slice(0, 3);

    const acoesExposure = Number(classMap.Acoes?.valorBrl ?? 0);
    const usdExposure = Number(currencyRows.find((row) => row.moeda === "USD")?.valorBrl ?? 0);
    const eurExposure = Number(currencyRows.find((row) => row.moeda === "EUR")?.valorBrl ?? 0);
    const bolsaShock = -(acoesExposure * 0.15);
    const usdShock = -(usdExposure * 0.1);
    const eurShock = -(eurExposure * 0.1);
    const bolsaShockPct = totalCurrent > 0 ? (bolsaShock / totalCurrent) * 100 : 0;
    const usdShockPct = totalCurrent > 0 ? (usdShock / totalCurrent) * 100 : 0;
    const eurShockPct = totalCurrent > 0 ? (eurShock / totalCurrent) * 100 : 0;

    const alerts = [];
    if (mainPositionPct > 20 && mainPosition) {
      alerts.push({
        id: "alerta_maior_posicao",
        titulo: "Alerta inteligente",
        badge: "RISCO",
        texto_curto: `${mainPosition.symbol} representa ${mainPositionPct.toFixed(1)}% da carteira.`,
        texto_detalhado: "Concentracao acima da faixa de atencao para uma unica posicao.",
        metricas: [
          {
            label: "Maior posicao",
            valor: `${mainPositionPct.toFixed(1)}%`,
            dica: "Acima de 20% aumenta risco especifico.",
          },
        ],
        acoes_sugeridas: [
          "Avaliar rebalanceamento para reduzir dependencia de um unico ativo.",
          "Distribuir aporte futuro em outras classes.",
          "Revisar limite maximo por posicao.",
        ],
      });
    }
    if (top5Pct > 60) {
      alerts.push({
        id: "alerta_top5",
        titulo: "Alerta inteligente",
        badge: "RISCO",
        texto_curto: `Top 5 posicoes concentram ${top5Pct.toFixed(1)}% do patrimonio.`,
        texto_detalhado: "Carteira sensivel a movimentos de poucos ativos.",
        metricas: [
          { label: "Top 5", valor: `${top5Pct.toFixed(1)}%`, dica: "Acima de 60% indica concentracao alta." },
        ],
        acoes_sugeridas: [
          "Diluir novos aportes entre ativos e classes menos representados.",
          "Definir meta de concentracao maxima para top 5.",
          "Acompanhar correlacao entre os maiores pesos.",
        ],
      });
    }
    if (riskScore >= 75) {
      alerts.push({
        id: "alerta_risco_geral",
        titulo: "Alerta inteligente",
        badge: "RISCO",
        texto_curto: `Score de risco em ${riskScore.toFixed(1)} (perfil ${riskProfile.perfil}).`,
        texto_detalhado: "A carteira esta mais exposta a volatilidade por classe.",
        metricas: [{ label: "Score", valor: riskScore.toFixed(1), dica: "Escala de 0 a 100." }],
        acoes_sugeridas: [
          "Avaliar aumento gradual de classes de menor volatilidade.",
          "Manter reserva para reduzir necessidade de venda em queda.",
          "Revisar horizonte e tolerancia a risco.",
        ],
      });
    }
    if (totalProfitPct < 0) {
      alerts.push({
        id: "alerta_drawdown",
        titulo: "Alerta inteligente",
        badge: "ATENCAO",
        texto_curto: `Drawdown atual: ${formatSignedPercent(totalProfitPct)}.`,
        texto_detalhado: "A carteira esta abaixo do capital investido no acumulado.",
        metricas: [
          {
            label: "Resultado acumulado",
            valor: formatCurrency(totalProfit, { currency: "BRL", sign: "auto" }),
            dica: "Comparacao valor atual vs investimento inicial.",
          },
        ],
        acoes_sugeridas: [
          "Evitar mudancas por emocao em periodos de queda.",
          "Reforcar disciplina de aporte e diversificacao por classe.",
          "Reavaliar distribuicao de risco da carteira.",
        ],
      });
    }
    if ((usdExposure + eurExposure) / (totalCurrent || 1) > 0.6) {
      alerts.push({
        id: "alerta_moeda",
        titulo: "Alerta inteligente",
        badge: "ATENCAO",
        texto_curto: "Exposicao cambial relevante em USD/EUR.",
        texto_detalhado: "Oscilacoes de cambio podem impactar fortemente o resultado em BRL.",
        metricas: [
          {
            label: "USD + EUR",
            valor: `${(((usdExposure + eurExposure) / (totalCurrent || 1)) * 100).toFixed(1)}%`,
            dica: "Exposicao cambial consolidada.",
          },
        ],
        acoes_sugeridas: [
          "Definir faixa alvo de exposicao cambial.",
          "Balancear aportes entre BRL e moedas fortes.",
          "Monitorar impacto de cenarios de cambio no patrimonio total.",
        ],
      });
    }

    const cards = [
      {
        id: "resumo",
        titulo: "Resumo do momento",
        badge: totalProfitPct >= 0 ? "OK" : totalProfitPct <= -10 ? "RISCO" : "ATENCAO",
        texto_curto: `Hoje sua carteira vale ${formatCurrency(totalCurrent, { currency: "BRL" })}. O acumulado esta em ${formatSignedPercent(totalProfitPct)}.`,
        texto_detalhado:
          totalProfitPct < 0
            ? "Neste momento voce esta em drawdown. O foco agora e proteger consistencia, risco e diversificacao."
            : "Voce esta no positivo. O proximo passo e manter disciplina para preservar ganhos sem aumentar concentracao.",
        metricas: [
          {
            label: "Valor atual",
            valor: formatCurrency(totalCurrent, { currency: "BRL" }),
            dica: "Valor consolidado da carteira em BRL.",
          },
          {
            label: "Lucro/Prejuizo",
            valor: formatCurrency(totalProfit, { currency: "BRL", sign: "auto" }),
            dica: formatSignedPercent(totalProfitPct),
          },
          {
            label: "Ativos monitorados",
            valor: String(monitoredAssets),
            dica: `Variacao diaria consolidada: ${formatSignedPercent(dailyVariationPct)}`,
          },
        ],
        acoes_sugeridas: [
          "Revisar a carteira em ciclos curtos para evitar desvio de alocacao.",
          "Manter aportes consistentes, sem reagir a ruido diario.",
          "Usar concentracao e risco como guia antes de qualquer ajuste.",
        ],
      },
      {
        id: "risco",
        titulo: "Risco",
        badge: riskProfile.badge,
        texto_curto: `Seu risco consolidado esta em ${riskScore.toFixed(1)}/100 (${riskProfile.perfil}).`,
        texto_detalhado: "Esse score considera o peso por classe: renda fixa 10, ETF 35, acoes 65, cripto 90.",
        metricas: [
          { label: "Score de risco", valor: riskScore.toFixed(1), dica: `Perfil ${riskProfile.perfil}` },
          {
            label: "Parcela em acoes",
            valor: `${Number(classMap.Acoes?.pct ?? 0).toFixed(1)}%`,
            dica: "Parcela mais sensivel em cenarios de queda da bolsa.",
          },
        ],
        acoes_sugeridas: [
          "Definir uma faixa de risco alvo para sua carteira.",
          "Se quiser reduzir oscilacao, subir gradualmente classes defensivas.",
          "Rebalancear em datas fixas para evitar decisoes impulsivas.",
        ],
      },
      {
        id: "concentracao",
        titulo: "Concentracao",
        badge: mainPositionPct > 20 || top5Pct > 60 ? "RISCO" : "OK",
        texto_curto:
          mainPositionPct > 0
            ? `Hoje ${mainPosition?.symbol ?? "sua maior posicao"} puxa ${mainPositionPct.toFixed(1)}% da carteira e o top 5 soma ${top5Pct.toFixed(1)}%.`
            : "Ainda nao ha dados suficientes de concentracao.",
        texto_detalhado: "Quanto maior a concentracao, maior a dependencia de poucos ativos para seu resultado.",
        metricas: [
          {
            label: "Maior posicao",
            valor: `${mainPositionPct.toFixed(1)}%`,
            dica: mainPosition ? `${mainPosition.symbol} · ${formatCurrency(mainPosition.currentBrl, { currency: "BRL" })}` : "Sem dados",
          },
          { label: "Top 5", valor: `${top5Pct.toFixed(1)}%`, dica: "Faixa de alerta acima de 60%." },
        ],
        acoes_sugeridas: [
          "Usar novos aportes para diluir os maiores pesos.",
          "Definir limite maximo por posicao para controle de risco.",
          "Revisar concentracao apos altas fortes no portfolio.",
        ],
      },
      {
        id: "cenario_crise",
        titulo: "Cenario de crise",
        badge: Number(classMap.Acoes?.pct ?? 0) > 70 ? "RISCO" : "ATENCAO",
        texto_curto:
          Number(classMap.Acoes?.pct ?? 0) > 85
            ? "Hoje praticamente todo seu patrimonio depende da bolsa."
            : `Hoje ${Number(classMap.Acoes?.pct ?? 0).toFixed(1)}% da carteira depende da bolsa.`,
        texto_detalhado: "Se a parcela de acoes cair 15%, este seria o impacto aproximado no valor total da carteira.",
        metricas: [
          { label: "Parcela em acoes", valor: `${Number(classMap.Acoes?.pct ?? 0).toFixed(1)}%`, dica: formatCurrency(acoesExposure, { currency: "BRL" }) },
          {
            label: "Impacto estimado",
            valor: formatCurrency(bolsaShock, { currency: "BRL", sign: "auto" }),
            dica: `${formatSignedPercent(bolsaShockPct)} do patrimonio total`,
          },
        ],
        acoes_sugeridas: [
          "Tratar esse cenario como teste de estresse da sua estrategia.",
          "Se quiser reduzir risco, diminuir dependencia de uma unica classe.",
          "Manter plano de rebalanceamento antes da proxima oscilacao forte.",
        ],
      },
      {
        id: "exposicao_moeda",
        titulo: "Exposicao por moeda",
        badge: "ATENCAO",
        texto_curto: "Seu patrimonio tambem oscila com o cambio de USD e EUR.",
        texto_detalhado: "Abaixo esta o impacto aproximado no total da carteira em cenarios de queda de 10% nas moedas.",
        metricas: [
          {
            label: "USD",
            valor: `${((usdExposure / (totalCurrent || 1)) * 100).toFixed(1)}%`,
            dica: `-10% no dolar: ${formatCurrency(usdShock, { currency: "BRL", sign: "auto" })} (${formatSignedPercent(usdShockPct)})`,
          },
          {
            label: "EUR",
            valor: `${((eurExposure / (totalCurrent || 1)) * 100).toFixed(1)}%`,
            dica: `-10% no euro: ${formatCurrency(eurShock, { currency: "BRL", sign: "auto" })} (${formatSignedPercent(eurShockPct)})`,
          },
        ],
        acoes_sugeridas: [
          "Definir faixa alvo por moeda para reduzir surpresa no patrimonio em BRL.",
          "Distribuir novos aportes entre BRL, USD e EUR conforme sua estrategia.",
          "Acompanhar cambio junto do risco por classe.",
        ],
      },
      {
        id: "exposicao_classe",
        titulo: "Exposicao por classe",
        badge: "OK",
        texto_curto: "Essa distribuicao explica de onde vem sua volatilidade atual.",
        texto_detalhado: "Quanto maior o peso em classes agressivas, maior a amplitude das oscilacoes.",
        metricas: [
          { label: "Acoes", valor: `${Number(classMap.Acoes?.pct ?? 0).toFixed(1)}%`, dica: formatCurrency(acoesExposure, { currency: "BRL" }) },
          { label: "ETF", valor: `${Number(classMap.ETF?.pct ?? 0).toFixed(1)}%`, dica: "Complemento de diversificacao em bolsa." },
          { label: "Cripto", valor: `${Number(classMap.Cripto?.pct ?? 0).toFixed(1)}%`, dica: "Parcela de maior variabilidade." },
        ],
        acoes_sugeridas: [
          "Faixas educacionais para reduzir volatilidade: renda fixa 20-40%, acoes 40-70%, ETF 10-25%, cripto 0-10%.",
          "Ajustar faixas conforme objetivo, prazo e tolerancia a risco.",
          "Lembrete: educacional, nao e recomendacao de investimento.",
        ],
      },
      {
        id: "top_vencedores",
        titulo: "Top 3 vencedores",
        badge: "OK",
        texto_curto: "Ativos que mais puxaram a carteira para cima.",
        texto_detalhado: "Ranking por rentabilidade percentual atual.",
        metricas: topWinners.map((row) => ({
          label: row.symbol,
          valor: formatSignedPercent(row.rentPct),
          dica: formatCurrency(row.currentBrl, { currency: "BRL" }),
        })),
        acoes_sugeridas: [
          "Monitorar se ganhos estao gerando concentracao acima do alvo.",
          "Reavaliar pesos apos altas expressivas.",
          "Manter disciplina de risco sem perseguir performance passada.",
        ],
      },
      {
        id: "top_detratores",
        titulo: "Top 3 detratores",
        badge: topDetractors.some((row) => row.rentPct < -20) ? "RISCO" : "ATENCAO",
        texto_curto: "Ativos que mais pressionaram sua carteira para baixo.",
        texto_detalhado: "Queda forte pede revisao de risco e peso, sem decisao por impulso.",
        metricas: topDetractors.map((row) => ({
          label: row.symbol,
          valor: formatSignedPercent(row.rentPct),
          dica: formatCurrency(row.currentBrl, { currency: "BRL" }),
        })),
        acoes_sugeridas: [
          "Revisar tese e peso de risco por classe.",
          "Evitar concentrar novos aportes em ativos ja superexpostos.",
          "Usar rebalanceamento para manter alocacao alvo.",
        ],
      },
      ...alerts.slice(0, 5),
    ];

    const insightsRapidos = [
      `Risco consolidado em ${riskScore.toFixed(1)} (${riskProfile.perfil}).`,
      `Cenario de estresse: bolsa -15% pode impactar cerca de ${formatCurrency(bolsaShock, { currency: "BRL", sign: "auto" })}.`,
      `Concentracao: maior posicao ${mainPositionPct.toFixed(1)}% e top 5 ${top5Pct.toFixed(1)}%.`,
    ];
    if (totalProfitPct < 0) {
      insightsRapidos.push(`Drawdown atual em ${formatSignedPercent(totalProfitPct)} (${formatCurrency(totalProfit, { currency: "BRL", sign: "auto" })}).`);
    }

    return {
      cards,
      insights_rapidos: insightsRapidos,
      observacoes: [
        "educacional, nao recomendacao de investimento",
        "fontes: supabase (carteira/vw_rentabilidade_carteira), yahoo/brapi para cotacoes",
        totalInvested > 0 ? "cenarios e score baseados em heuristica da composicao atual" : "carteira sem base suficiente para estimativas",
      ],
    };
  }, [allocation, allocationByCurrency, consolidatedRates, consolidatedTotals, mergedRows]);

  const snapshotDraft = useMemo(() => {
    const totalCurrent = Number(consolidatedTotals.totalCurrent ?? 0);
    const totalInvested = Number(consolidatedTotals.totalInvested ?? 0);
    const pnlBrl = Number(consolidatedTotals.profit ?? 0);
    const pnlPct = Number(consolidatedTotals.rentabilityPercent ?? 0);
    const classPct = {
      stocks: 0,
      etf: 0,
      fixedIncome: 0,
      alternatives: 0,
      other: 0,
    };
    allocation.forEach((entry) => {
      const type = String(entry.type ?? "").toLowerCase();
      const pct = totalCurrent > 0 ? (Number(entry.totalCurrent ?? 0) / totalCurrent) * 100 : 0;
      if (type === "acao" || type === "renda_variavel") classPct.stocks += pct;
      else if (type === "etf" || type === "fundos") classPct.etf += pct;
      else if (type === "renda_fixa") classPct.fixedIncome += pct;
      else if (type === "cripto" || type === "criptomoedas") classPct.alternatives += pct;
      else classPct.other += pct;
    });

    const currencyPct = {
      BRL: 0,
      USD: 0,
      EUR: 0,
      CRYPTO: 0,
    };
    allocationByCurrency.forEach((entry) => {
      const key = String(entry.label ?? "").toUpperCase();
      const pct = totalCurrent > 0 ? (Number(entry.totalCurrent ?? 0) / totalCurrent) * 100 : 0;
      if (currencyPct[key] !== undefined) {
        currencyPct[key] += pct;
      }
    });

    const classRowsForRisk = [
      { pct: classPct.fixedIncome, weight: 10 },
      { pct: classPct.etf, weight: 35 },
      { pct: classPct.stocks, weight: 65 },
      { pct: classPct.alternatives, weight: 90 },
    ];
    const riskScore = classRowsForRisk.reduce((acc, row) => acc + (row.pct * row.weight) / 100, 0);
    const riskLevel = riskScore >= 67 ? "AGRESSIVO" : riskScore >= 34 ? "MODERADO" : "CONSERVADOR";

    const rowsInBrl = mergedRows
      .map((row) => {
        const currency = String(row.currency ?? "BRL").toUpperCase();
        const rate = Number.isFinite(consolidatedRates[currency]) ? consolidatedRates[currency] : 1;
        return {
          symbol: row.symbol,
          currentBrl: Number(row.currentTotal ?? 0) * rate,
          rentPct: Number(row.rentPercent ?? 0),
          dailyChange: Number(row.dailyChange),
        };
      })
      .filter((row) => Number.isFinite(row.currentBrl) && row.currentBrl > 0);
    const rowsBySize = [...rowsInBrl].sort((a, b) => b.currentBrl - a.currentBrl);
    const top1 = rowsBySize[0] ?? null;
    const top1Pct = totalCurrent > 0 ? ((top1?.currentBrl ?? 0) / totalCurrent) * 100 : 0;
    const top5Total = rowsBySize.slice(0, 5).reduce((acc, row) => acc + row.currentBrl, 0);
    const top5Pct = totalCurrent > 0 ? (top5Total / totalCurrent) * 100 : 0;
    const topGainer = [...rowsInBrl].sort((a, b) => b.rentPct - a.rentPct)[0] ?? null;
    const topLoser = [...rowsInBrl].sort((a, b) => a.rentPct - b.rentPct)[0] ?? null;
    const dailyLoser = [...rowsInBrl]
      .filter((row) => Number.isFinite(row.dailyChange))
      .sort((a, b) => a.dailyChange - b.dailyChange)[0] ?? null;
    const dailyLoserImpactBrl =
      dailyLoser && Number.isFinite(dailyLoser.dailyChange)
        ? (dailyLoser.currentBrl * Math.min(0, dailyLoser.dailyChange)) / 100
        : null;

    return {
      snapshot_date: toLocalIsoDate(),
      portfolio_value_brl: totalCurrent,
      pnl_brl: pnlBrl,
      pnl_pct: pnlPct,
      risk_score: riskScore,
      risk_level: riskLevel,
      top1_pct: top1Pct,
      top5_pct: top5Pct,
      brl_pct: currencyPct.BRL,
      usd_pct: currencyPct.USD,
      eur_pct: currencyPct.EUR,
      crypto_pct: currencyPct.CRYPTO,
      stocks_pct: classPct.stocks,
      etf_pct: classPct.etf,
      fixed_income_pct: classPct.fixedIncome,
      alternatives_pct: classPct.alternatives,
      other_pct: classPct.other,
      top_gainer_ticker: topGainer?.symbol ?? null,
      top_gainer_pct: Number.isFinite(topGainer?.rentPct) ? topGainer.rentPct : null,
      top_loser_ticker: topLoser?.symbol ?? null,
      top_loser_pct: Number.isFinite(topLoser?.rentPct) ? topLoser.rentPct : null,
      payload: {
        invested_brl: totalInvested,
        top1_ticker: top1?.symbol ?? null,
        daily_loser_ticker: dailyLoser?.symbol ?? null,
        daily_loser_change_pct: Number.isFinite(dailyLoser?.dailyChange) ? dailyLoser.dailyChange : null,
        daily_loser_impact_brl: Number.isFinite(dailyLoserImpactBrl) ? dailyLoserImpactBrl : null,
      },
    };
  }, [allocation, allocationByCurrency, consolidatedRates, consolidatedTotals, mergedRows]);

  useEffect(() => {
    if (!user || fetching || mergedRows.length === 0) {
      setRecentChanges((prev) => ({ ...prev, loading: false }));
      return;
    }

    const syncKey = [
      user.id,
      snapshotDraft.snapshot_date,
      mergedRows.length,
      Math.round(snapshotDraft.portfolio_value_brl),
      snapshotDraft.risk_score.toFixed(2),
      snapshotDraft.top1_pct.toFixed(2),
      snapshotDraft.top5_pct.toFixed(2),
    ].join(":");
    if (snapshotSyncKeyRef.current === syncKey) {
      return;
    }
    snapshotSyncKeyRef.current = syncKey;

    let cancelled = false;
    setRecentChanges((prev) => ({ ...prev, loading: true }));

    const runSnapshotSync = async () => {
      try {
        await upsertPortfolioSnapshot({
          user_id: user.id,
          ...snapshotDraft,
        });

        const rows = await listRecentPortfolioSnapshots({ userId: user.id, limit: 60 });
        if (cancelled) return;

        const current = rows[0] ?? null;
        if (!current) {
          setRecentChanges({
            loading: false,
            tone: "info",
            title: "Nao consegui montar suas mudancas agora.",
            subtitle: "Tente atualizar em alguns instantes.",
            baselineDate: null,
          });
          return;
        }

        const storageKey = `korden:last_seen_snapshot:${user.id}`;
        const seenDate = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
        const alreadySeenToday = Boolean(seenDate && seenDate === current.snapshot_date);

        let baseline = null;
        if (seenDate) {
          baseline = rows.find((row) => row.snapshot_date === seenDate) ?? null;
        }
        if (!baseline) {
          baseline = rows.find((row) => row.snapshot_date !== current.snapshot_date) ?? null;
        }

        if (!baseline) {
          setRecentChanges({
            loading: false,
            tone: "info",
            title: "Primeira analise salva com sucesso.",
            subtitle: "Na proxima abertura eu te mostro o que mudou na sua carteira.",
            baselineDate: null,
          });
          if (typeof window !== "undefined") {
            window.localStorage.setItem(storageKey, current.snapshot_date);
          }
          return;
        }

        if (alreadySeenToday) {
          setRecentChanges({
            loading: false,
            tone: "info",
            title: "Voce ja viu as mudancas de hoje.",
            subtitle: "Nenhuma novidade importante desde sua ultima abertura.",
            baselineDate: baseline.snapshot_date ?? null,
          });
          return;
        }

        const candidates = [];
        const valueDelta = Number(current.portfolio_value_brl ?? 0) - Number(baseline.portfolio_value_brl ?? 0);
        const valueBase = Number(baseline.portfolio_value_brl ?? 0);
        const valueDeltaPct = valueBase > 0 ? (valueDelta / valueBase) * 100 : 0;
        if (Math.abs(valueDeltaPct) >= 1.5) {
          candidates.push({
            priority: 1,
            tone: valueDelta >= 0 ? "positive" : "risk",
            title:
              valueDelta >= 0
                ? `Seu patrimonio cresceu ${formatCurrency(valueDelta, { currency: "BRL", sign: "auto" })} desde a ultima analise.`
                : `Seu patrimonio caiu ${formatCurrency(valueDelta, { currency: "BRL", sign: "auto" })} desde a ultima analise.`,
            subtitle: `Variacao acumulada de ${valueDeltaPct >= 0 ? "+" : ""}${valueDeltaPct.toFixed(2)}% no periodo.`,
          });
        }

        const riskDelta = Number(current.risk_score ?? 0) - Number(baseline.risk_score ?? 0);
        if (Math.abs(riskDelta) >= 1) {
          candidates.push({
            priority: 2,
            tone: riskDelta > 0 ? (riskDelta >= 3 ? "risk" : "attention") : "positive",
            title: riskDelta > 0 ? "Sua carteira ficou mais arriscada hoje." : "Sua carteira ficou menos arriscada hoje.",
            subtitle: `Score de risco: ${Number(baseline.risk_score ?? 0).toFixed(1)} -> ${Number(current.risk_score ?? 0).toFixed(1)}.`,
          });
        }

        const top1Delta = Number(current.top1_pct ?? 0) - Number(baseline.top1_pct ?? 0);
        if (top1Delta >= 1) {
          const topTicker = current?.payload?.top1_ticker;
          candidates.push({
            priority: 3,
            tone: top1Delta >= 3 ? "risk" : "attention",
            title: topTicker ? `A alta de ${topTicker} aumentou sua concentracao.` : "Sua concentracao aumentou.",
            subtitle: `Maior posicao passou de ${Number(baseline.top1_pct ?? 0).toFixed(1)}% para ${Number(current.top1_pct ?? 0).toFixed(1)}%.`,
          });
        }

        const brlDelta = Number(current.brl_pct ?? 0) - Number(baseline.brl_pct ?? 0);
        if (Math.abs(brlDelta) >= 2) {
          candidates.push({
            priority: 4,
            tone: brlDelta > 0 ? "attention" : "info",
            title:
              brlDelta > 0
                ? `Sua exposicao ao Brasil aumentou ${brlDelta.toFixed(1)}%.`
                : `Sua exposicao ao Brasil reduziu ${Math.abs(brlDelta).toFixed(1)}%.`,
            subtitle: `Participacao em BRL: ${Number(baseline.brl_pct ?? 0).toFixed(1)}% -> ${Number(current.brl_pct ?? 0).toFixed(1)}%.`,
          });
        }

        const gainerChanged =
          String(current.top_gainer_ticker || "") !== String(baseline.top_gainer_ticker || "") && Boolean(current.top_gainer_ticker);
        const loserChanged =
          String(current.top_loser_ticker || "") !== String(baseline.top_loser_ticker || "") && Boolean(current.top_loser_ticker);
        if (gainerChanged || loserChanged) {
          const ticker = current.top_loser_ticker || current.top_gainer_ticker;
          const pct = Number(current.top_loser_pct ?? current.top_gainer_pct ?? 0);
          const isLoser = Boolean(current.top_loser_ticker && current.top_loser_ticker === ticker);
          candidates.push({
            priority: 5,
            tone: isLoser ? "attention" : "info",
            title: isLoser ? `${ticker} virou seu principal detrator.` : `${ticker} virou seu principal destaque positivo.`,
            subtitle: `Variacao acumulada de ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% para esse ativo.`,
          });
        }

        const primary = [...candidates].sort((a, b) => a.priority - b.priority)[0] ?? {
          priority: 99,
          tone: "info",
          title: "Hoje sua carteira permaneceu estavel.",
          subtitle: "Nenhuma mudanca importante desde a ultima analise.",
        };

        setRecentChanges({
          loading: false,
          tone: primary.tone,
          title: primary.title,
          subtitle: primary.subtitle,
          baselineDate: baseline.snapshot_date ?? null,
        });

        if (typeof window !== "undefined") {
          window.localStorage.setItem(storageKey, current.snapshot_date);
        }
      } catch (snapshotError) {
        console.warn("[snapshot] falha ao salvar/comparar analise:", snapshotError?.message || snapshotError);
        if (!cancelled) {
          setRecentChanges({
            loading: false,
            tone: "info",
            title: "Nao foi possivel carregar mudancas recentes agora.",
            subtitle: "Tente novamente em instantes.",
            baselineDate: null,
          });
        }
      }
    };

    runSnapshotSync();
    return () => {
      cancelled = true;
    };
  }, [fetching, mergedRows.length, snapshotDraft, user]);

  const selectedRow = useMemo(() => mergedRows.find((row) => row.symbol === selectedSymbol) ?? null, [mergedRows, selectedSymbol]);

  const handleSelectSymbol = (symbol) => {
    console.log("[ui] selecionando", symbol);
    setSelectedSymbol(symbol);
  };

  const handleRemovePosition = useCallback(
    async (symbol) => {
      if (!user) return;

      const normalizedSymbol = normalizeAssetSymbol(symbol);
      const confirm = window.confirm(`Deseja remover ${normalizedSymbol} da sua carteira?`);
      if (!confirm) return;

      try {
        await deletePortfolioPosition({ userId: user.id, ativoSymbol: normalizedSymbol });
                toast.success(`${normalizedSymbol} removido da carteira.`);
        setRefreshToken((token) => token + 1);
      } catch (deleteError) {
        console.error(deleteError);
        toast.error(deleteError.message || "Nao foi possivel remover a posicao.");
      }
    },
    [user],
  );

  const handleEditPosition = useCallback(
    (symbol) => {
      const normalizedSymbol = normalizeAssetSymbol(symbol);
      const position = positionBySymbol.get(normalizedSymbol);
      if (position) {
        navigate("/investir/novo", { state: { position } });
      } else {
        navigate("/investir/novo", { state: { position: null, symbol: normalizedSymbol } });
      }
    },
    [navigate, positionBySymbol],
  );

  const handleRegisterAsset = useCallback(async () => {
    if (!selectedRow) return;
    try {
      const asset = await getAssetBySymbol(selectedRow.symbol);
      if (!asset) {
        await upsertAsset({
          symbol: selectedRow.symbol,
          nome: selectedRow.name ?? selectedRow.symbol,
          tipo: selectedRow.type ?? "outro",
          moeda: selectedRow.currency ?? "BRL",
        });
      }
      toast.success("Ativo registrado com sucesso.");
      setRefreshToken((token) => token + 1);
    } catch (err) {
      console.error(err);
      toast.error("Nao foi possivel registrar o ativo.");
    }
  }, [selectedRow]);

  const lineChartOption = useMemo(
    () =>
      selectedRow && history.length
        ? buildHistoryOption(history, selectedRow.symbol, selectedRow.currency)
        : buildHistoryOption([], selectedRow?.symbol ?? "", selectedRow?.currency ?? "BRL"),
    [history, selectedRow],
  );

  const allocationOption = useMemo(() => buildAllocationOption(allocation), [allocation]);
  const currencyAllocationOption = useMemo(
    () =>
      buildAllocationOption(
        allocationByCurrency.map((entry) => ({
          ...entry,
          totalCurrent: entry.totalCurrent,
        })),
      ),
    [allocationByCurrency],
  );

  const showAuthNotice = !authLoading && !user;
  const showEmptyState = !fetching && !showAuthNotice && mergedRows.length === 0;
  const analysisUpdatedTodayLabel = useMemo(() => {
    return new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, []);
  const summaryInsightCard = useMemo(
    () => portfolioInsights.cards.find((card) => card.id === "resumo") ?? null,
    [portfolioInsights.cards],
  );
  const attentionInsightCards = useMemo(() => {
    const order = ["risco", "concentracao", "cenario_crise"];
    return order
      .map((id) => portfolioInsights.cards.find((card) => card.id === id))
      .filter(Boolean);
  }, [portfolioInsights.cards]);
  const complementaryInsightCards = useMemo(() => {
    const excluded = new Set(["resumo", "risco", "concentracao", "cenario_crise"]);
    return portfolioInsights.cards.filter((card) => !excluded.has(card.id));
  }, [portfolioInsights.cards]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Investimentos e rentabilidade</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Consolide seus ativos, acompanhe a rentabilidade e visualize a evolucao da carteira em tempo real.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/investir/novo"
            className="inline-flex items-center justify-center rounded-lg bg-temaSky px-4 py-2 text-sm font-semibold text-white transition hover:bg-temaSky-dark dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark"
          >
            Registrar ativo
          </Link>
          <button
            type="button"
            onClick={() => setRefreshToken((token) => token + 1)}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-temaSky hover:text-temaSky dark:border-gray-700 dark:text-gray-300 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
          >
            Atualizar dados
          </button>
        </div>
      </header>

      {showAuthNotice && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          Entre na sua conta para visualizar a carteira de investimentos.
        </div>
      )}

      {error && !showAuthNotice && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-sm text-rose-600 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-200">
          Nao foi possivel carregar sua carteira. Tente novamente.
        </div>
      )}

      {!showAuthNotice && (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Dolar (USD/BRL)</p>
              <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {Number.isFinite(marketRates.usdBrl) ? formatCurrency(marketRates.usdBrl, { currency: "BRL" }) : "—"}
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {marketRates.updatedAt
                  ? `Atualizado em ${new Date(marketRates.updatedAt).toLocaleString("pt-BR")}`
                  : "Cotacao indisponivel"}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Euro (EUR/BRL)</p>
              <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {Number.isFinite(marketRates.eurBrl) ? formatCurrency(marketRates.eurBrl, { currency: "BRL" }) : "—"}
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {marketRates.updatedAt
                  ? `Atualizado em ${new Date(marketRates.updatedAt).toLocaleString("pt-BR")}`
                  : "Cotacao indisponivel"}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Bitcoin (BTC/BRL)</p>
              <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {Number.isFinite(marketRates.btcBrl) ? formatCurrency(marketRates.btcBrl, { currency: "BRL" }) : "—"}
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {marketRates.sourceBtc
                  ? `Fonte: ${marketRates.sourceBtc}${marketRates.btcSymbol ? ` (${marketRates.btcSymbol})` : ""}`
                  : "Cotacao indisponivel"}
              </p>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SummaryCard
              title="Investido em BRL"
              value={formatCurrencyOrDash(investedByCurrency.stats.BRL.total, "BRL", investedByCurrency.stats.BRL.count > 0)}
              helper={
                investedByCurrency.stats.BRL.count > 0
                  ? `${investedByCurrency.percentages.BRL.toFixed(1)}% do total`
                  : "—"
              }
            />
            <SummaryCard
              title="Investido em USD"
              value={formatCurrencyOrDash(investedByCurrency.stats.USD.total, "USD", investedByCurrency.stats.USD.count > 0)}
              helper={
                investedByCurrency.stats.USD.count > 0
                  ? `${investedByCurrency.percentages.USD.toFixed(1)}% do total${
                      fxHelpers.USD
                        ? ` · ≈ ${formatCurrency(investedByCurrency.stats.USD.total * fxHelpers.USD, {
                            currency: "BRL",
                          })}`
                        : ""
                    }`
                  : "—"
              }
            />
            <SummaryCard
              title="Investido em EUR"
              value={formatCurrencyOrDash(investedByCurrency.stats.EUR.total, "EUR", investedByCurrency.stats.EUR.count > 0)}
              helper={
                investedByCurrency.stats.EUR.count > 0
                  ? `${investedByCurrency.percentages.EUR.toFixed(1)}% do total${
                      fxHelpers.EUR
                        ? ` · ≈ ${formatCurrency(investedByCurrency.stats.EUR.total * fxHelpers.EUR, {
                            currency: "BRL",
                          })}`
                        : ""
                    }`
                  : "—"
              }
            />
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Valor atual da carteira"
              value={formatCurrency(consolidatedTotals.totalCurrent, { currency: CONSOLIDATED_CURRENCY })}
              helper={`Investimento inicial (${CONSOLIDATED_CURRENCY}): ${formatCurrency(consolidatedTotals.totalInvested, { currency: CONSOLIDATED_CURRENCY })}`}
              accent
            />
            <SummaryCard
              title="Lucro/prejuizo acumulado"
              value={formatCurrency(consolidatedTotals.profit, { currency: CONSOLIDATED_CURRENCY, sign: "auto" })}
              helper={formatPercent(consolidatedTotals.rentabilityPercent)}
            />
            <SummaryCard title="Variacao diaria" value={formatPercent(consolidatedTotals.dailyChange)} helper="Atualizado pela Yahoo Finance" />
            <SummaryCard title="Ativos monitorados" value={mergedRows.length} helper="Quantidade de posicoes" />
          </section>

          {!hasPremiumAccess && (
            <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50 p-5 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-200">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">Dados em tempo real sao exclusivos do plano Premium.</p>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-200/80">
                    As cotaAcoes exibidas podem estar desatualizadas. Faca upgrade para ativar atualizaAcoes automaticas a cada 15 minutos.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canStartTrial && (
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent("granaapp:activate-trial"))}
                      className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-emerald-500 hover:to-sky-500"
                    >
                      Ativar teste Premium
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("granaapp:open-plans"))}
                    className="inline-flex items-center justify-center rounded-full border border-emerald-400/70 px-4 py-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-100 dark:border-emerald-500/40 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                  >
                    Ver planos
                  </button>
                </div>
              </div>
            </div>
          )}

          <section className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Distribuicao da carteira</h2>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Por tipo de ativo</span>
                </div>
                {allocation.length ? (
                  <ReactECharts option={allocationOption} notMerge lazyUpdate style={{ height: 260, width: "100%" }} />
                ) : (
                  <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Cadastre ativos para visualizar a distribuicao.</p>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Distribuicao por moeda</h2>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Valores convertidos em BRL</span>
                </div>
                {allocationByCurrency.length ? (
                  <ReactECharts option={currencyAllocationOption} notMerge lazyUpdate style={{ height: 260, width: "100%" }} />
                ) : (
                  <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Cadastre ativos para visualizar a distribuicao.</p>
                )}
              </div>
            </div>

            {!fetching && !showEmptyState && (
              <section className="space-y-4">
                <article
                  className={`rounded-2xl border p-4 shadow-sm transition ${
                    resolveChangesBannerTone(recentChanges.tone).container
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className={`text-sm font-semibold ${resolveChangesBannerTone(recentChanges.tone).title}`}>
                        Mudancas recentes
                      </h3>
                      <p className={`text-xs ${resolveChangesBannerTone(recentChanges.tone).subtitle}`}>
                        {recentChanges.baselineDate
                          ? `Comparando com ${DATE_FORMATTER_FULL.format(new Date(`${recentChanges.baselineDate}T12:00:00`))}`
                          : "Comparando com sua ultima analise salva"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${resolveChangesBannerTone(recentChanges.tone).badge}`}
                    >
                      {recentChanges.loading ? "Atualizando..." : "Hoje"}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className={`text-sm font-semibold ${resolveChangesBannerTone(recentChanges.tone).title}`}>{recentChanges.title}</p>
                    <p className={`text-xs ${resolveChangesBannerTone(recentChanges.tone).subtitle}`}>{recentChanges.subtitle}</p>
                  </div>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => analysisSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition ${resolveChangesBannerTone(recentChanges.tone).button}`}
                    >
                      Ver analise
                    </button>
                  </div>
                </article>

                <div ref={analysisSectionRef} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Korden Portfolio Analyst</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Diagnostico automatico da carteira com foco em risco, concentracao e cenarios.
                      </p>
                      <p className="mt-1 text-xs font-medium text-sky-600 dark:text-sky-300">Analise atualizada hoje ({analysisUpdatedTodayLabel})</p>
                    </div>
                    <span className="rounded-full border border-gray-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:text-gray-300">
                      Formato JSON interno
                    </span>
                  </div>
                </div>

                {summaryInsightCard && (
                  <article className="rounded-2xl border border-sky-200 bg-sky-50 p-6 shadow-sm dark:border-sky-500/40 dark:bg-sky-900/20">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{summaryInsightCard.titulo}</h3>
                      <span className="rounded-full border border-sky-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-700 dark:border-sky-400/50 dark:bg-sky-900/50 dark:text-sky-200">
                        {summaryInsightCard.badge}
                      </span>
                    </div>
                    <p className="mt-3 text-base text-slate-800 dark:text-slate-100">{summaryInsightCard.texto_curto}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{summaryInsightCard.texto_detalhado}</p>
                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {(summaryInsightCard.metricas ?? []).map((metrica, index) => (
                        <div key={`resumo-metrica-${index}`} className="rounded-lg border border-sky-100 bg-white p-3 dark:border-sky-500/20 dark:bg-slate-900/50">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{metrica.label}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{metrica.valor}</p>
                          {metrica.dica ? <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{metrica.dica}</p> : null}
                        </div>
                      ))}
                    </div>
                  </article>
                )}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {attentionInsightCards.map((card) => {
                    const badgeTone =
                      card.badge === "RISCO"
                        ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/20 dark:text-rose-200"
                        : card.badge === "ATENCAO"
                          ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-200"
                          : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/20 dark:text-emerald-200";

                    return (
                      <article key={card.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{card.titulo}</h3>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeTone}`}>
                            {card.badge}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{card.texto_curto}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{card.texto_detalhado}</p>

                        {Array.isArray(card.metricas) && card.metricas.length > 0 && (
                          <div className="mt-3 space-y-1 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950">
                            {card.metricas.map((metrica, index) => (
                              <p key={`${card.id}-metrica-${index}`} className="text-xs text-gray-600 dark:text-gray-300">
                                <strong className="text-gray-900 dark:text-gray-100">{metrica.label}:</strong> {metrica.valor}
                                {metrica.dica ? <span className="text-gray-500 dark:text-gray-400"> · {metrica.dica}</span> : null}
                              </p>
                            ))}
                          </div>
                        )}

                        {Array.isArray(card.acoes_sugeridas) && card.acoes_sugeridas.length > 0 && (
                          <div className="mt-3 space-y-1">
                            {card.acoes_sugeridas.slice(0, 3).map((acao, index) => (
                              <p key={`${card.id}-acao-${index}`} className="text-xs text-gray-600 dark:text-gray-300">
                                {index + 1}. {acao}
                              </p>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {complementaryInsightCards.map((card) => {
                    const badgeTone =
                      card.badge === "RISCO"
                        ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/20 dark:text-rose-200"
                        : card.badge === "ATENCAO"
                          ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-200"
                          : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/20 dark:text-emerald-200";

                    return (
                      <article key={`complementar-${card.id}`} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{card.titulo}</h3>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeTone}`}>
                            {card.badge}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{card.texto_curto}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{card.texto_detalhado}</p>
                        {Array.isArray(card.metricas) && card.metricas.length > 0 && (
                          <div className="mt-3 space-y-1 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950">
                            {card.metricas.map((metrica, index) => (
                              <p key={`complementar-${card.id}-metrica-${index}`} className="text-xs text-gray-600 dark:text-gray-300">
                                <strong className="text-gray-900 dark:text-gray-100">{metrica.label}:</strong> {metrica.valor}
                                {metrica.dica ? <span className="text-gray-500 dark:text-gray-400"> · {metrica.dica}</span> : null}
                              </p>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Insights rapidos</h3>
                    <div className="mt-2 space-y-1">
                      {portfolioInsights.insights_rapidos.map((insight, index) => (
                        <p key={`insight-${index}`} className="text-xs text-gray-600 dark:text-gray-300">
                          {index + 1}. {insight}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Observacoes</h3>
                    <div className="mt-2 space-y-1">
                      {portfolioInsights.observacoes.map((item, index) => (
                        <p key={`obs-${index}`} className="text-xs text-gray-600 dark:text-gray-300">
                          - {item}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Posicoes consolidadas</h2>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Fonte: Yahoo Finance</span>
                </div>

                {fetching && (
                  <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">Carregando carteira...</p>
                )}

                {showEmptyState && (
                  <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                    Nenhum ativo na carteira ainda. Cadastre o primeiro para visualizar a rentabilidade.
                  </p>
                )}

                {!fetching && !showEmptyState && (
                  <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-800">
                      <thead className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-3 text-left">Ativo</th>
                          <th className="px-4 py-3 text-right">Quantidade</th>
                          <th className="px-4 py-3 text-right">Preco medio</th>
                          <th className="px-4 py-3 text-right">Cotacao atual</th>
                          <th className="px-4 py-3 text-right">Valor atual</th>
                          <th className="px-4 py-3 text-right">Dia %</th>
                          <th className="px-4 py-3 text-right">Rentabilidade %</th>
                          <th className="px-4 py-3 text-right">Lucro/Prejuizo</th>
                          <th className="px-4 py-3 text-right">AAcoes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {mergedRows.map((row) => {
                          const isSelected = selectedSymbol === row.symbol;
                          return (
                            <tr
                              key={row.symbol}
                              className={`transition hover:bg-slate-50 dark:hover:bg-slate-800/40 ${isSelected ? "bg-slate-50 dark:bg-slate-800/40" : ""}`}
                            >
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => handleSelectSymbol(row.symbol)}
                                  className="text-left font-semibold text-temaSky hover:underline dark:text-temaEmerald"
                                >
                                  {row.symbol}
                                </button>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {row.name ?? "Descricao indisponivel"}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-right">{row.quantity.toLocaleString("pt-BR")}</td>
                              <td className="px-4 py-3 text-right">{formatCurrency(row.averagePrice, { currency: row.currency })}</td>
                              <td className="px-4 py-3 text-right">
                                {hasPremiumAccess ? formatCurrency(row.currentPrice, { currency: row.currency }) : "--"}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {hasPremiumAccess ? formatCurrency(row.currentTotal, { currency: row.currency }) : "--"}
                              </td>
                              <td
                                className={`px-4 py-3 text-right ${
                                  row.dailyChange === null
                                    ? "text-gray-500"
                                    : row.dailyChange >= 0
                                      ? "text-emerald-500"
                                      : "text-rose-500"
                                }`}
                              >
                                {row.dailyChange === null ? "--" : formatPercent(row.dailyChange)}
                              </td>
                              <td className={`px-4 py-3 text-right ${row.rentPercent >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {formatPercent(row.rentPercent)}
                              </td>
                              <td className={`px-4 py-3 text-right ${row.profit >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {formatCurrency(row.profit, { currency: row.currency, sign: "auto" })}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditPosition(row.symbol)}
                                    className="text-xs font-semibold text-temaSky hover:underline dark:text-temaEmerald"
                                  >
                                    Ajustar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePosition(row.symbol)}
                                    className="text-xs font-semibold text-rose-500 hover:underline"
                                  >
                                    Remover
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Historico de precos</h2>
                  {selectedRow?.lastUpdate && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Atualizado em {new Date(selectedRow.lastUpdate).toLocaleString("pt-BR")}
                    </span>
                  )}
                </div>

                {!hasPremiumAccess && (
                  <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    Liberado no plano Premium e durante o teste gratuito.
                  </p>
                )}

                {hasPremiumAccess && (
                  <>
                    {selectedRow && (
                      <div className="mt-4 grid gap-2 rounded-xl border border-dashed border-gray-200 bg-white p-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300 sm:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Ticker</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedRow.symbol}</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">Moeda: {selectedRow.currency}</p>
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Ultima cotacao</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {formatCurrency(selectedRow.currentPrice, { currency: selectedRow.currency })}
                          </p>
                          <p
                            className={`text-[11px] font-semibold ${
                              Number(selectedRow.dailyChange) >= 0 ? "text-emerald-500" : "text-rose-500"
                            }`}
                          >
                            Dia:{" "}
                            {Number.isFinite(Number(selectedRow.dailyChange))
                              ? formatPercent(Number(selectedRow.dailyChange))
                              : "--"}
                          </p>
                        </div>
                      </div>
                    )}
                    {historyLoading ? (
                      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Carregando historico...</p>
                    ) : history.length ? (
                      <ReactECharts option={lineChartOption} notMerge lazyUpdate style={{ height: 320, width: "100%" }} />
                    ) : (
                      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                        Sem dados de historico para esta data. Aguarde a proxima atualizacao automatica.
                      </p>
                    )}
                  </>
                )}

                {selectedRow && (
                  <div className="mt-4 space-y-2 rounded-xl border border-dashed border-gray-200 p-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <p>
                      <strong>Moeda:</strong> {selectedRow.currency}
                    </p>
                    <p>
                      <strong>Origem do cadastro:</strong> {selectedRow.origin}
                    </p>
                    {selectedRow.notes ? <p className="text-gray-400 dark:text-gray-500">{selectedRow.notes}</p> : null}
                    <button
                      type="button"
                      onClick={handleRegisterAsset}
                      className="text-xs font-semibold text-temaSky hover:underline dark:text-temaEmerald"
                    >
                      Sincronizar informacoes do ativo
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}



































