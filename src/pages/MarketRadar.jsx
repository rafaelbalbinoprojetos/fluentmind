import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import { listPortfolioPositions } from "../services/portfolio.js";
import { addAssetToWatchlist, createRadarPriceAlert, getRadarFeedForUser, removeAssetFromWatchlist } from "../services/marketRadar.js";

function signalTagClasses(signalType) {
  if (signalType === "momentum" || signalType === "new_high") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/25 dark:text-emerald-200";
  }
  if (signalType === "drawdown") {
    return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/25 dark:text-amber-200";
  }
  if (signalType === "intl_diversification") {
    return "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-900/25 dark:text-sky-200";
  }
  if (signalType === "dividends") {
    return "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-900/25 dark:text-indigo-200";
  }
  return "border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200";
}

function stateBadgeClasses(state) {
  if (state === "entered_today") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/20 dark:text-emerald-200";
  }
  if (state === "stayed") {
    return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-200";
  }
  return "border-gray-300 bg-gray-50 text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300";
}

function watchlistStatusBadge(item) {
  const inRadar = item?.radarState === "entered_today" || item?.radarState === "stayed";
  if (inRadar) {
    return {
      label: "No radar agora",
      className: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/20 dark:text-emerald-200",
    };
  }
  return {
    label: "Fora do radar",
    className: "border-gray-300 bg-gray-50 text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300",
  };
}

function formatDateTime(value) {
  if (!value) return "agora";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "agora";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toDayKey(date = new Date()) {
  const now = new Date(date);
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
}

function shiftDayKey(dayKey, days = 0) {
  const date = new Date(`${dayKey}T12:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return toDayKey(date);
}

function daysBetweenDayKeys(fromKey, toKey) {
  if (!fromKey || !toKey) return null;
  const from = new Date(`${fromKey}T12:00:00`);
  const to = new Date(`${toKey}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
}

function labelSignal(signalTitle) {
  return signalTitle || "Sinal de mercado";
}

function RadarCard({
  item,
  actionLoading,
  onWatch,
  onCreateAlert,
  onCompare,
  showWatchlistStatus = false,
  showRemoveWatchlist = false,
  onRemoveWatchlist = null,
}) {
  const watchlistBadge = watchlistStatusBadge(item);
  return (
    <article className="w-[330px] shrink-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.symbol}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{item.name}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-300">{item.countryFlag}</span>
          <span
            title={item.stateTooltip}
            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stateBadgeClasses(item.radarState)}`}
          >
            {item.radarStateEmoji} {item.radarStateLabel}
          </span>
        </div>
      </div>

      <span className={`mt-3 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${signalTagClasses(item.signalType)}`}>
        {item.signalTitle}
      </span>
      {showWatchlistStatus ? (
        <span className={`ml-2 mt-3 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${watchlistBadge.className}`}>
          {watchlistBadge.label}
        </span>
      ) : null}

      <div className="mt-3 space-y-1">
        {(item.reasons ?? []).slice(0, 3).map((reason, index) => (
          <p key={`${item.id}-reason-${index}`} className="text-xs text-gray-600 dark:text-gray-300">
            - {reason}
          </p>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onWatch(item.symbol)}
          disabled={Boolean(actionLoading[`watch:${item.symbol}`]) || item.watchlistedByUser}
          className="rounded-lg border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-700 transition hover:border-temaSky hover:text-temaSky disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
        >
          {item.watchlistedByUser ? "Na watchlist" : actionLoading[`watch:${item.symbol}`] ? "..." : "Acompanhar"}
        </button>
        <button
          type="button"
          onClick={() => onCreateAlert(item.symbol)}
          disabled={Boolean(actionLoading[`alert:${item.symbol}`])}
          className="rounded-lg border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-700 transition hover:border-temaSky hover:text-temaSky disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
        >
          {actionLoading[`alert:${item.symbol}`] ? "..." : "Criar alerta"}
        </button>
        <button
          type="button"
          onClick={() => onCompare(item)}
          className="rounded-lg border border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-700 transition hover:border-temaSky hover:text-temaSky dark:border-gray-700 dark:text-gray-200 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
        >
          Comparar carteira
        </button>
      </div>

      {showRemoveWatchlist && typeof onRemoveWatchlist === "function" ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => onRemoveWatchlist(item.symbol)}
            disabled={Boolean(actionLoading[`remove:${item.symbol}`])}
            className="rounded-lg border border-rose-300 px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
          >
            {actionLoading[`remove:${item.symbol}`] ? "Removendo..." : "Remover da watchlist"}
          </button>
        </div>
      ) : null}

      <div className="mt-3">
        <Link
          to={`/radar/ativo/${encodeURIComponent(item.symbol)}`}
          state={{ item }}
          className="text-xs font-semibold text-temaSky transition hover:underline dark:text-temaEmerald"
        >
          Ver detalhe do ativo
        </Link>
      </div>
    </article>
  );
}

export default function MarketRadarPage() {
  const { user } = useAuth();
  const [positions, setPositions] = useState([]);
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [activeTab, setActiveTab] = useState("today");
  const [showHowModal, setShowHowModal] = useState(false);
  const [dateFilter, setDateFilter] = useState("today");
  const [customDate, setCustomDate] = useState("");
  const [visibleStates, setVisibleStates] = useState({
    entered: true,
    stayed: true,
    exited: true,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) {
        setFeed(null);
        setPositions([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const userPositions = await listPortfolioPositions({ userId: user.id });
        if (cancelled) return;
        setPositions(userPositions ?? []);
        const todayKey = toDayKey();
        const selectedDate =
          dateFilter === "yesterday"
            ? shiftDayKey(todayKey, -1)
            : dateFilter === "custom" && customDate
              ? customDate
              : todayKey;
        const rangeDays = dateFilter === "last7" ? 7 : 1;
        const radarFeed = await getRadarFeedForUser({
          userId: user.id,
          positions: userPositions ?? [],
          date: selectedDate,
          rangeDays,
        });
        if (cancelled) return;
        setFeed(radarFeed);
      } catch (loadError) {
        if (cancelled) return;
        console.error(loadError);
        setError(loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, dateFilter, customDate]);

  const watchlistSymbols = useMemo(
    () => new Set((feed?.watchlist ?? []).map((item) => String(item.symbol || "").toUpperCase())),
    [feed?.watchlist],
  );

  const watchlistItems = useMemo(() => {
    const current = feed?.items ?? [];
    const exited = feed?.exitedItems ?? [];
    const selectedDate = feed?.selectedDate ?? toDayKey();
    const inRadarNow = new Set(current.map((item) => String(item.symbol || "").toUpperCase()));
    const bySymbol = new Map();
    current.forEach((item) => bySymbol.set(item.symbol, item));
    exited.forEach((item) => {
      if (!bySymbol.has(item.symbol)) {
        bySymbol.set(item.symbol, item);
      }
    });
    return [...watchlistSymbols].map((symbol) => {
      const found = bySymbol.get(symbol);
      if (found) {
        const daysAgo = daysBetweenDayKeys(found.feedDate, selectedDate);
        const changePct = Number(found.metrics?.change_pct ?? null);
        return {
          ...found,
          reasons: [
            `Ultimo sinal detectado: ${labelSignal(found.signalTitle)}${Number.isFinite(daysAgo) ? ` (ha ${daysAgo} dia${daysAgo === 1 ? "" : "s"})` : ""}.`,
            Number.isFinite(changePct)
              ? `Mudanca recente: ${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}% no dia.`
              : "Mudanca recente: sem leitura do dia.",
            `Status atual: ${inRadarNow.has(symbol) ? "no radar" : "fora do radar"}.`,
          ],
        };
      }
      return {
        id: `watchlist-${symbol}`,
        symbol,
        name: symbol,
        countryFlag: "BR",
        signalType: "momentum",
        signalTitle: "Fora do radar hoje",
        reasons: [
          "Ultimo sinal detectado: indisponivel no periodo selecionado.",
          "Mudanca recente: sem leitura do dia.",
          "Status atual: fora do radar.",
        ],
        radarState: "exited",
        radarStateLabel: "Fora do radar",
        radarStateEmoji: "⚪",
        stateTooltip: "Hoje este ativo nao atingiu criterios para permanecer no radar.",
        watchlistedByUser: true,
      };
    });
  }, [feed?.items, feed?.exitedItems, feed?.selectedDate, watchlistSymbols]);

  const stayedItems = useMemo(() => feed?.stayedItems ?? [], [feed?.stayedItems]);

  const filteredSections = useMemo(() => {
    const allowEntered = visibleStates.entered;
    const allowStayed = visibleStates.stayed;
    return (feed?.sections ?? []).map((section) => ({
      ...section,
      items: (section.items ?? []).filter((item) => {
        if (item.radarState === "entered_today") return allowEntered;
        if (item.radarState === "stayed") return allowStayed;
        return true;
      }),
    }));
  }, [feed?.sections, visibleStates.entered, visibleStates.stayed]);

  const filteredExitedItems = useMemo(() => {
    if (!visibleStates.exited) return [];
    return feed?.exitedItems ?? [];
  }, [feed?.exitedItems, visibleStates.exited]);
  const evaluatedAssets = useMemo(() => {
    const byKey = new Map();
    const currentItems = feed?.items ?? [];
    const exited = feed?.exitedItems ?? [];

    [...currentItems, ...exited].forEach((item) => {
      const symbol = String(item?.symbol || "").toUpperCase();
      const signal = item?.signalTitle || item?.signalType || "Sinal de mercado";
      const key = `${symbol}:${signal}`;
      if (!symbol || byKey.has(key)) return;
      const reasons = Array.isArray(item?.reasons) ? item.reasons.slice(0, 3) : [];
      byKey.set(key, {
        key,
        symbol,
        name: item?.name || symbol,
        radarStateLabel: item?.radarStateLabel || "Sem status",
        radarStateEmoji: item?.radarStateEmoji || "",
        signal,
        score: Number(item?.rankScore ?? 0),
        considerations: reasons.length > 0 ? reasons.join(" | ") : "Sem consideracoes registradas.",
      });
    });

    return [...byKey.values()].sort((a, b) => b.score - a.score);
  }, [feed?.items, feed?.exitedItems]);

  const handleWatch = async (symbol) => {
    if (!user?.id) return;
    setActionLoading((prev) => ({ ...prev, [`watch:${symbol}`]: true }));
    try {
      await addAssetToWatchlist({ userId: user.id, symbol, source: "radar" });
      toast.success(`${symbol} adicionado para acompanhar.`);
      setFeed((prev) => {
        if (!prev) return prev;
        const nextWatchlist = [...(prev.watchlist ?? [])];
        if (!nextWatchlist.some((item) => String(item.symbol).toUpperCase() === symbol.toUpperCase())) {
          nextWatchlist.unshift({ symbol, source: "radar", created_at: new Date().toISOString() });
        }
        const items = (prev.items ?? []).map((item) =>
          item.symbol === symbol ? { ...item, watchlistedByUser: true } : item,
        );
        const sections = (prev.sections ?? []).map((section) => ({
          ...section,
          items: [...section.items]
            .map((item) => (item.symbol === symbol ? { ...item, watchlistedByUser: true } : item))
            .sort((a, b) => {
              if (a.watchlistedByUser !== b.watchlistedByUser) return a.watchlistedByUser ? -1 : 1;
              return b.rankScore - a.rankScore;
            }),
        }));
        return { ...prev, watchlist: nextWatchlist, items, sections };
      });
    } catch (watchError) {
      console.error(watchError);
      toast.error("Nao foi possivel salvar na watchlist agora.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [`watch:${symbol}`]: false }));
    }
  };

  const handleCreateAlert = async (symbol) => {
    if (!user?.id) return;
    const rawPrice = window.prompt(`Preco alvo para ${symbol}:`, "");
    if (!rawPrice) return;
    const parsed = Number(String(rawPrice).replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Preco invalido.");
      return;
    }
    const directionInput = window.prompt("Tipo de alerta: acima ou abaixo?", "acima");
    const direction = String(directionInput || "acima").toLowerCase().includes("abaixo") ? "below" : "above";
    setActionLoading((prev) => ({ ...prev, [`alert:${symbol}`]: true }));
    try {
      await createRadarPriceAlert({ userId: user.id, symbol, targetPrice: parsed, direction });
      toast.success(`Alerta criado para ${symbol}.`);
    } catch (alertError) {
      console.error(alertError);
      toast.error("Nao foi possivel criar o alerta agora.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [`alert:${symbol}`]: false }));
    }
  };

  const handleCompare = (item) => {
    const positionSymbols = new Set((positions ?? []).map((row) => String(row.ativo_symbol || "").toUpperCase()));
    const itemSymbol = String(item?.symbol || "").toUpperCase();
    if (positionSymbols.has(itemSymbol)) {
      toast.success(`Voce ja tem ${itemSymbol} na sua carteira.`);
      return;
    }
    const textBySignal = {
      low_vol: "Voce nao tem nenhum ativo desse tipo na sua carteira hoje (baixa volatilidade).",
      dividends: "Voce nao tem nenhum ativo desse tipo na sua carteira hoje (perfil de dividendos).",
      drawdown: "Voce nao tem nenhum ativo desse tipo na sua carteira hoje (queda relevante).",
      new_high: "Voce nao tem nenhum ativo desse tipo na sua carteira hoje (nova maxima).",
      momentum: "Voce nao tem nenhum ativo desse tipo na sua carteira hoje (tendencia forte).",
      intl_diversification: "Voce nao tem nenhum ativo desse tipo na sua carteira hoje (diversificacao internacional).",
    };
    toast(textBySignal[item?.signalType] || "Voce nao tem nenhum ativo desse tipo na sua carteira.");
  };

  const handleRemoveWatchlist = async (symbol) => {
    if (!user?.id || !symbol) return;
    setActionLoading((prev) => ({ ...prev, [`remove:${symbol}`]: true }));
    try {
      await removeAssetFromWatchlist({ userId: user.id, symbol });
      toast.success(`${symbol} removido da watchlist.`);
      setFeed((prev) => {
        if (!prev) return prev;
        const nextWatchlist = (prev.watchlist ?? []).filter(
          (entry) => String(entry.symbol || "").toUpperCase() !== String(symbol).toUpperCase(),
        );
        const items = (prev.items ?? []).map((item) =>
          String(item.symbol || "").toUpperCase() === String(symbol).toUpperCase()
            ? { ...item, watchlistedByUser: false }
            : item,
        );
        const sections = (prev.sections ?? []).map((section) => ({
          ...section,
          items: (section.items ?? []).map((item) =>
            String(item.symbol || "").toUpperCase() === String(symbol).toUpperCase()
              ? { ...item, watchlistedByUser: false }
              : item,
          ),
        }));
        return { ...prev, watchlist: nextWatchlist, items, sections };
      });
    } catch (removeError) {
      console.error(removeError);
      toast.error("Nao foi possivel remover da watchlist agora.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [`remove:${symbol}`]: false }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          Atualizando o radar de hoje...
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[1, 2, 3].map((key) => (
            <div key={key} className="h-40 animate-pulse rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-300 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/20 dark:text-rose-200">
        Nao foi possivel carregar o Radar do Mercado agora.
      </div>
    );
  }

  const sections = filteredSections;
  const exitedItems = filteredExitedItems;
  const summary = feed?.summary ?? {};
  const staleDays = Number(feed?.freshness?.staleDays ?? 0);
  const usedFallbackFeed = Boolean(feed?.freshness?.usedFallbackFeed);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Radar do Mercado</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          O Korden encontrou movimentos relevantes no mercado para voce acompanhar.
        </p>
      </header>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("today")}
          className={`rounded-full px-4 py-2 text-xs font-semibold ${
            activeTab === "today"
              ? "bg-temaSky text-white dark:bg-temaEmerald"
              : "border border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300"
          }`}
        >
          Radar de Hoje
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("watchlist")}
          className={`rounded-full px-4 py-2 text-xs font-semibold ${
            activeTab === "watchlist"
              ? "bg-temaSky text-white dark:bg-temaEmerald"
              : "border border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300"
          }`}
        >
          Minha Watchlist
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
        <label className="font-semibold text-gray-700 dark:text-gray-200">Data do Radar:</label>
        <select
          value={dateFilter}
          onChange={(event) => setDateFilter(event.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
        >
          <option value="today">Hoje</option>
          <option value="yesterday">Ontem</option>
          <option value="last7">Ultimos 7 dias</option>
          <option value="custom">Escolher data...</option>
        </select>
        {dateFilter === "custom" ? (
          <input
            type="date"
            value={customDate}
            onChange={(event) => setCustomDate(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
          />
        ) : null}

        <span className="ml-auto font-semibold text-gray-700 dark:text-gray-200">Mostrar:</span>
        <label className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={visibleStates.entered}
            onChange={(event) => setVisibleStates((prev) => ({ ...prev, entered: event.target.checked }))}
          />
          Entrou hoje
        </label>
        <label className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={visibleStates.stayed}
            onChange={(event) => setVisibleStates((prev) => ({ ...prev, stayed: event.target.checked }))}
          />
          Continuam
        </label>
        <label className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={visibleStates.exited}
            onChange={(event) => setVisibleStates((prev) => ({ ...prev, exited: event.target.checked }))}
          />
          Sairam
        </label>
      </div>

      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm dark:border-sky-500/40 dark:bg-sky-900/20">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-200">Resumo diario</p>
        <p className="mt-2 text-base font-semibold text-sky-900 dark:text-sky-100">{summary.headline}</p>
        <p className="mt-1 text-sm text-sky-900/90 dark:text-sky-100/90">
          Entraram hoje: {summary.enteredCount ?? 0} | Continuam: {summary.stayedCount ?? 0} | Sairam: {summary.exitedCount ?? 0}
        </p>
        {summary.exitedText ? (
          <div className="mt-2 rounded-xl border border-sky-300/70 bg-white/70 px-3 py-2 text-xs text-sky-900 dark:border-sky-400/30 dark:bg-sky-950/20 dark:text-sky-100">
            <p className="font-semibold">{summary.exitedText}</p>
            <div className="mt-1 space-y-0.5">
              {(summary.exitedPreview ?? []).map((item) => (
                <p key={`exit-${item.symbol}`}>- {item.symbol}: {item.text}</p>
              ))}
            </div>
          </div>
        ) : null}
        <p className="mt-1 text-xs text-sky-800/90 dark:text-sky-200/90">Atualizado em: {formatDateTime(feed?.updatedAt)}</p>
        {(usedFallbackFeed || staleDays >= 3) ? (
          <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-200">
            {usedFallbackFeed
              ? "Nao houve ativos nos dias mais recentes. Exibindo o ultimo dia com ativos no radar."
              : `Sem atualizacao recente do radar ha ${staleDays} dia(s).`}
          </div>
        ) : null}
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowHowModal(true)}
            className="text-xs font-semibold text-sky-700 underline underline-offset-2 dark:text-sky-200"
          >
            Como o radar funciona?
          </button>
          <span className="text-[11px] text-sky-800/90 dark:text-sky-200/90">
            Detector de sinais para acompanhamento. Nao e recomendacao de investimento.
          </span>
        </div>
      </section>

      {activeTab === "today" ? (
        <>
          {stayedItems.length > 0 && visibleStates.stayed ? (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Continuam no radar</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Ativos que seguem com sinais ativos desde a leitura anterior.</p>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">{stayedItems.length} ativos</span>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-1">
                {stayedItems.map((item) => (
                  <RadarCard
                    key={`stayed-${item.id}`}
                    item={item}
                    actionLoading={actionLoading}
                    onWatch={handleWatch}
                    onCreateAlert={handleCreateAlert}
                    onCompare={handleCompare}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {sections.map((section) => (
            <section key={section.id} className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{section.title}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{section.description}</p>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">{section.items.length} ativos</span>
              </div>

              {section.items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  {section.emptyMessage || "Nenhum ativo entrou nesse sinal hoje."}
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-1">
                  {section.items.map((item) => (
                    <RadarCard
                      key={item.id}
                      item={item}
                      actionLoading={actionLoading}
                      onWatch={handleWatch}
                      onCreateAlert={handleCreateAlert}
                      onCompare={handleCompare}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}

          {exitedItems.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Sairam do radar</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Ativos que perderam forca na ultima atualizacao.</p>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">{exitedItems.length} ativos</span>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-1">
                {exitedItems.map((item) => (
                  <RadarCard
                    key={item.id}
                    item={item}
                    actionLoading={actionLoading}
                    onWatch={handleWatch}
                    onCreateAlert={handleCreateAlert}
                    onCompare={handleCompare}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Minha Watchlist</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Ativos que voce escolheu para acompanhar com prioridade.</p>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">{watchlistItems.length} ativos</span>
          </div>

          {watchlistItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              Sua watchlist ainda esta vazia. Use "Acompanhar" para comecar.
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-1">
              {watchlistItems.map((item) => (
                <RadarCard
                  key={`watch-${item.id}`}
                  item={item}
                  actionLoading={actionLoading}
                  onWatch={handleWatch}
                  onCreateAlert={handleCreateAlert}
                  onCompare={handleCompare}
                  showWatchlistStatus
                  showRemoveWatchlist
                  onRemoveWatchlist={handleRemoveWatchlist}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {positions.length === 0 && (
        <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          Sem posicoes em carteira ainda. O radar funciona, mas com menor personalizacao ate voce registrar ativos.
        </section>
      )}

      <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:p-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ativos avaliados</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Historico da leitura atual do radar com as consideracoes geradas para cada ativo.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-xs dark:divide-gray-800">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-gray-950 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left">Ativo</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Sinal</th>
                <th className="px-3 py-2 text-right">Score</th>
                <th className="px-3 py-2 text-left">Consideracoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {evaluatedAssets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-500 dark:text-gray-400">
                    Nenhum ativo avaliado no periodo selecionado.
                  </td>
                </tr>
              ) : (
                evaluatedAssets.map((row) => (
                  <tr key={row.key}>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{row.symbol}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">{row.name}</p>
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                      {row.radarStateEmoji} {row.radarStateLabel}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.signal}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">
                      {Number.isFinite(row.score) ? row.score.toFixed(1) : "0.0"}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.considerations}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showHowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-lg dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Como o radar funciona</h3>
              <button
                type="button"
                onClick={() => setShowHowModal(false)}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Fechar
              </button>
            </div>
            <div className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-300">
              <p>O radar filtra ativos liquidos e identifica sinais em categorias objetivas.</p>
              <p>Os ativos podem entrar, manter ou sair do radar conforme os sinais mudam.</p>
              <p>O foco e acompanhamento e entendimento de movimento, nao recomendacao de compra ou venda.</p>
              <p>Detector de sinais para acompanhamento. Nao e recomendacao de investimento.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
