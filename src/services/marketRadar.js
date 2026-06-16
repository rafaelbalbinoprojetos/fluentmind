import { supabase } from "../lib/supabase.js";
import { RADAR_SIGNAL_DEFINITIONS, RADAR_UNIVERSE } from "../data/radarUniverse.js";

const WATCHLIST_TABLE = "user_watchlist";
const ALERTS_TABLE = "user_price_alerts";
const RADAR_DAILY_FEED_TABLE = "radar_daily_feed";
const RADAR_USER_ITEMS_TABLE = "radar_user_items";

const COUNTRY_LABELS = { BR: "Brasil", US: "Estados Unidos" };
const COUNTRY_FLAGS = { BR: "BR", US: "US" };
const SIGNAL_ORDER = ["momentum", "new_high", "drawdown", "dividends", "low_vol", "intl_diversification"];
const PRIMARY_SIGNAL_PRIORITY = ["new_high", "drawdown", "momentum", "dividends", "low_vol", "intl_diversification"];
const SIGNAL_SUBTITLES = {
  momentum: "Ativos com forca de preco e liquidez para observar.",
  new_high: "Ativos que renovaram maxima de 52 semanas.",
  drawdown: "Ativos liquidos com queda forte recente que vale entender.",
  dividends: "Pagadores recorrentes para acompanhamento de longo prazo.",
  low_vol: "Ativos com oscilacao mais controlada na janela recente.",
  intl_diversification: "Ativos internacionais para ampliar sua visao de mercado.",
};

function normalizedDayKey(date = new Date()) {
  const now = new Date(date);
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
}

function shiftDayKey(dateKey, days = 0) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return normalizedDayKey(date);
}

function dayDistance(fromKey, toKey) {
  if (!fromKey || !toKey) return null;
  const from = new Date(`${fromKey}T12:00:00`);
  const to = new Date(`${toKey}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
}

function hashString(input = "") {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function isBrazilSymbol(symbol) {
  return String(symbol || "").toUpperCase().endsWith(".SA");
}

function normalizeSignalType(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "momentum";
  if (normalized === "max52w") return "new_high";
  return SIGNAL_ORDER.includes(normalized) ? normalized : "momentum";
}

function getSignalMeta(signalType) {
  const id = normalizeSignalType(signalType);
  const def = RADAR_SIGNAL_DEFINITIONS[id] ?? RADAR_SIGNAL_DEFINITIONS.momentum;
  return {
    id,
    title: def.title,
    description: SIGNAL_SUBTITLES[id] ?? def.description ?? "Sinal de mercado para acompanhamento.",
  };
}

function signalPriority(signalType) {
  const normalized = normalizeSignalType(signalType);
  const index = PRIMARY_SIGNAL_PRIORITY.indexOf(normalized);
  return index === -1 ? 999 : index;
}

function dedupeByPrimarySignal(rows = []) {
  const rowSymbol = (row) => String(row?.symbol || "").toUpperCase();
  const rowSignal = (row) => normalizeSignalType(row?.signal_type ?? row?.signalType);
  const rowScore = (row) => Number(row?.rank_score ?? row?.rankScore ?? 0);
  const counts = new Map();
  const bySymbolOptions = new Map();

  rows.forEach((row) => {
    const symbol = rowSymbol(row);
    if (!symbol) return;
    if (!bySymbolOptions.has(symbol)) bySymbolOptions.set(symbol, []);
    bySymbolOptions.get(symbol).push(row);
  });

  const grouped = new Map();
  bySymbolOptions.forEach((options, symbol) => {
    const sorted = [...options].sort((a, b) => {
      const p = signalPriority(rowSignal(a)) - signalPriority(rowSignal(b));
      if (p !== 0) return p;
      return rowScore(b) - rowScore(a);
    });
    if (sorted[0]) {
      grouped.set(symbol, sorted[0]);
      const s = rowSignal(sorted[0]);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
  });

  const rebalanceTargets = ["dividends", "low_vol"];
  rebalanceTargets.forEach((targetSignal) => {
    if ((counts.get(targetSignal) ?? 0) > 0) return;

    let bestSwap = null;
    grouped.forEach((assignedRow, symbol) => {
      const options = bySymbolOptions.get(symbol) ?? [];
      const targetOption = options
        .filter((row) => rowSignal(row) === targetSignal)
        .sort((a, b) => rowScore(b) - rowScore(a))[0];
      if (!targetOption) return;

      const donorSignal = rowSignal(assignedRow);
      const donorCount = counts.get(donorSignal) ?? 0;
      if (donorSignal === targetSignal || donorCount <= 1) return;

      const swapRank = rowScore(targetOption) + donorCount * 0.5;
      if (!bestSwap || swapRank > bestSwap.swapRank) {
        bestSwap = { symbol, donorSignal, assignedRow, targetOption, swapRank };
      }
    });

    if (!bestSwap) return;
    grouped.set(bestSwap.symbol, bestSwap.targetOption);
    counts.set(bestSwap.donorSignal, Math.max(0, (counts.get(bestSwap.donorSignal) ?? 1) - 1));
    counts.set(targetSignal, (counts.get(targetSignal) ?? 0) + 1);
  });

  return [...grouped.values()];
}

function radarStateLabel(radarState) {
  if (radarState === "entered_today") return "Entrou hoje";
  if (radarState === "stayed") return "Mantem no radar";
  return "Saiu do radar";
}

function radarStateEmoji(radarState) {
  if (radarState === "entered_today") return "🟢";
  if (radarState === "stayed") return "🟡";
  return "⚪";
}

function reasonsFromMetrics(signalType, metrics = {}, fallbackReasons = []) {
  const vol30 = Number(metrics.vol_30d ?? null);
  const range30 = Number(metrics.range_30d ?? null);
  const posDays = Number(metrics.pos_days_30d ?? null);
  const ret30 = Number(metrics.return_30d ?? null);
  const ret6m = Number(metrics.return_6m ?? null);
  const drawdown = Number(metrics.drawdown_6m ?? null);
  const max52wDistance = Number(metrics.max52w_distance ?? null);

  if (signalType === "low_vol" && Number.isFinite(vol30)) {
    return [
      "oscilacao controlada nas ultimas semanas",
      `Volatilidade 30d: ${vol30.toFixed(2)}% ao dia`,
      Number.isFinite(range30) ? `Amplitude 30d (max-min): ${range30.toFixed(1)}%` : "Amplitude recente em observacao",
      Number.isFinite(posDays) ? `Dias positivos (30d): ${Math.round(posDays)}/30` : "Consistencia recente em observacao",
    ];
  }

  if (signalType === "momentum") {
    return [
      "movimento forte e continuo no preco",
      Number.isFinite(ret6m) ? `${ret6m >= 0 ? "+" : ""}${ret6m.toFixed(1)}% em 6 meses` : "Retorno de 6 meses em observacao",
      Number.isFinite(ret30) ? `${ret30 >= 0 ? "+" : ""}${ret30.toFixed(1)}% nos ultimos 30 dias` : "Retorno de 30 dias em observacao",
      "forca de movimento manteve ritmo na janela recente",
    ];
  }

  if (signalType === "new_high") {
    return [
      "rompeu patamar importante recente",
      Number.isFinite(max52wDistance) ? `Distancia da maxima: ${max52wDistance.toFixed(2)}%` : "Distancia da maxima em observacao",
      "sinal de continuidade que vale acompanhar",
    ];
  }

  if (signalType === "drawdown") {
    return [
      "queda expressiva recente que merece atencao",
      Number.isFinite(drawdown) ? `Drawdown 6m: ${drawdown.toFixed(1)}%` : "queda relevante em janela recente",
      Number.isFinite(range30) ? `Amplitude 30d: ${range30.toFixed(1)}%` : "movimento recente ainda aberto",
      "vale entender o contexto antes de qualquer decisao",
    ];
  }

  if (signalType === "dividends") {
    return [
      "historico recorrente de distribuicao",
      Number.isFinite(ret6m) ? `${ret6m >= 0 ? "+" : ""}${ret6m.toFixed(1)}% em 6 meses` : "retorno em observacao",
      "perfil de longo prazo para acompanhar com calma",
    ];
  }

  if (signalType === "intl_diversification") {
    return [
      "ativo internacional com boa liquidez",
      "ajuda a observar geografias diferentes",
      "complementa carteira concentrada no mercado local",
    ];
  }

  if (Array.isArray(fallbackReasons) && fallbackReasons.length > 0) {
    return fallbackReasons.slice(0, 3);
  }
  return ["entrou no radar por sinais de mercado"];
}

function stateTooltip(item) {
  if (item.radarState === "entered_today") {
    return `Entrou hoje porque os sinais desta janela ficaram acima do criterio do radar.`;
  }
  if (item.radarState === "stayed") {
    return `Permanece no radar porque os sinais continuam consistentes.`;
  }
  return `Saiu porque os sinais perderam forca na ultima atualizacao.`;
}

function createBaseItem(row, watchlistSet) {
  const signalType = normalizeSignalType(row.signal_type);
  const signalMeta = getSignalMeta(signalType);
  const metrics = row.metrics_json ?? {};
  const reasons = reasonsFromMetrics(signalType, metrics, row.reasons_json ?? []);
  return {
    id: `${row.feed_date}-${signalType}-${row.symbol}`,
    feedDate: row.feed_date ?? null,
    symbol: row.symbol,
    name: row.name ?? row.symbol,
    country: row.country ?? "BR",
    countryName: COUNTRY_LABELS[row.country] ?? row.country ?? "Brasil",
    countryFlag: COUNTRY_FLAGS[row.country] ?? row.country ?? "BR",
    assetType: row.asset_type ?? "Acoes",
    sector: row.sector ?? "Mercado",
    signalType,
    signalTitle: signalMeta.title,
    signalDescription: signalMeta.description,
    rankScore: Number(row.rank_score ?? 0),
    metrics,
    reasons,
    watchlistedByUser: watchlistSet.has(String(row.symbol || "").toUpperCase()),
    radarState: "entered_today",
    radarStateLabel: radarStateLabel("entered_today"),
    radarStateEmoji: radarStateEmoji("entered_today"),
    stateTooltip: "",
  };
}

function summarizeHeadline({ enteredCount, stayedCount, exitedCount }) {
  if (enteredCount === 0 && stayedCount === 0 && exitedCount === 0) {
    return "Hoje o mercado ficou mais estavel para acompanhar.";
  }
  if (enteredCount >= stayedCount && enteredCount >= exitedCount) {
    return "Hoje o mercado mostrou novos sinais para acompanhar.";
  }
  if (exitedCount > enteredCount && exitedCount > stayedCount) {
    return "Hoje alguns movimentos perderam forca e sairam do foco.";
  }
  return "Detectamos movimentos relevantes na bolsa desde a sua ultima analise.";
}

function applyStatesAndSections({ dateKey, currentItems, previousItems, watchlistSet, feedUpdatedAt }) {
  const currentPrimaryItems = dedupeByPrimarySignal(currentItems);
  const previousPrimaryItems = dedupeByPrimarySignal(previousItems);

  const previousMap = new Map(previousPrimaryItems.map((item) => [`${normalizeSignalType(item.signal_type)}:${item.symbol}`, item]));
  const currentMap = new Map(currentPrimaryItems.map((item) => [`${normalizeSignalType(item.signal_type)}:${item.symbol}`, item]));

  const hydratedCurrent = currentPrimaryItems.map((row) => {
    const base = createBaseItem(row, watchlistSet);
    const key = `${base.signalType}:${base.symbol}`;
    const stayed = previousMap.has(key);
    const radarState = stayed ? "stayed" : "entered_today";
    return {
      ...base,
      radarState,
      radarStateLabel: radarStateLabel(radarState),
      radarStateEmoji: radarStateEmoji(radarState),
      stateTooltip: stateTooltip({ radarState }),
    };
  });

  const exitedItems = previousPrimaryItems
    .filter((row) => !currentMap.has(`${normalizeSignalType(row.signal_type)}:${row.symbol}`))
    .map((row) => {
      const base = createBaseItem(row, watchlistSet);
      const radarState = "exited";
      return {
        ...base,
        id: `exited-${base.signalType}-${base.symbol}`,
        radarState,
        radarStateLabel: radarStateLabel(radarState),
        radarStateEmoji: radarStateEmoji(radarState),
        stateTooltip: stateTooltip({ radarState }),
      };
    })
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 5);

  const enteredCount = hydratedCurrent.filter((item) => item.radarState === "entered_today").length;
  const stayedCount = hydratedCurrent.filter((item) => item.radarState === "stayed").length;
  const exitedCount = exitedItems.length;
  const stayedItems = hydratedCurrent.filter((item) => item.radarState === "stayed");
  const enteredItems = hydratedCurrent.filter((item) => item.radarState === "entered_today");

  const grouped = new Map();
  SIGNAL_ORDER.forEach((signalType) => {
    const meta = getSignalMeta(signalType);
    grouped.set(signalType, { ...meta, items: [] });
  });

  hydratedCurrent.forEach((item) => {
    grouped.get(item.signalType)?.items.push(item);
  });

  const sections = [...grouped.values()].map((section) => {
    const ordered = [...section.items].sort((a, b) => {
      if (a.watchlistedByUser !== b.watchlistedByUser) return a.watchlistedByUser ? -1 : 1;
      return b.rankScore - a.rankScore;
    });
    return {
      ...section,
      items: ordered,
      count: ordered.length,
      emptyMessage: "Nenhum ativo entrou nesse sinal hoje.",
    };
  });

  const signalCounts = sections
    .filter((section) => section.items.length > 0)
    .map((section) => ({ title: section.title, count: section.items.length }))
    .sort((a, b) => b.count - a.count);

  const exitedPreview = exitedItems.slice(0, 3).map((item) => ({
    symbol: item.symbol,
    text:
      item.signalType === "momentum"
        ? "saiu da tendencia"
        : item.signalType === "new_high"
          ? "perdeu maxima recente"
          : item.signalType === "drawdown"
            ? "deixou de atender queda relevante"
            : item.signalType === "dividends"
              ? "saiu da leitura de dividendos"
              : "volatilidade mudou",
  }));

  return {
    date: dateKey,
    updatedAt: feedUpdatedAt ?? new Date().toISOString(),
    summary: {
      headline: summarizeHeadline({ enteredCount, stayedCount, exitedCount }),
      enteredCount,
      stayedCount,
      exitedCount,
      totalItems: hydratedCurrent.length,
      topSignals: signalCounts.slice(0, 3),
      exitedPreview,
      exitedText: exitedCount > 0 ? `${exitedCount} ativos deixaram o radar hoje.` : "",
      text:
        hydratedCurrent.length > 0
          ? `Hoje ${hydratedCurrent.length} ativos estao no radar para acompanhamento.`
          : "Hoje nao houve novos sinais relevantes nos filtros atuais.",
    },
    sections,
    exitedItems,
    stayedItems,
    enteredItems,
    items: hydratedCurrent,
    disclaimer: "Detector de sinais para acompanhamento. Nao e recomendacao de investimento.",
  };
}

async function listFeedRowsByDate({ userId, dateKey }) {
  const { data, error } = await supabase
    .from(RADAR_DAILY_FEED_TABLE)
    .select("*")
    .eq("user_id", userId)
    .lte("feed_date", dateKey)
    .order("feed_date", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

async function listFeedRowsByRange({ userId, startDateKey, endDateKey }) {
  const { data, error } = await supabase
    .from(RADAR_DAILY_FEED_TABLE)
    .select("*")
    .eq("user_id", userId)
    .gte("feed_date", startDateKey)
    .lte("feed_date", endDateKey)
    .order("feed_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function listRadarItems({ userId, feedDate }) {
  const { data, error } = await supabase
    .from(RADAR_USER_ITEMS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("feed_date", feedDate)
    .order("rank_score", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function listRadarItemsByDates({ userId, feedDates = [] }) {
  const cleanDates = [...new Set((feedDates || []).filter(Boolean))];
  if (!cleanDates.length) return [];
  const { data, error } = await supabase
    .from(RADAR_USER_ITEMS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .in("feed_date", cleanDates)
    .order("feed_date", { ascending: false })
    .order("rank_score", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listUserWatchlist({ userId }) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return [];
  const { data, error } = await supabase
    .from(WATCHLIST_TABLE)
    .select("*")
    .eq("user_id", normalizedUserId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function buildProfileFromPositions(positions = []) {
  const totalValue = positions.reduce(
    (acc, row) => acc + Math.max(0, Number(row.quantidade ?? 0) * Number(row.preco_medio ?? 0)),
    0,
  );
  if (totalValue <= 0) {
    return {
      riskScore: 55,
      top1Pct: 0,
      top5Pct: 0,
      brExposurePct: 0,
      usExposurePct: 0,
    };
  }
  const normalized = positions.map((row) => {
    const symbol = String(row.ativo_symbol || "").toUpperCase();
    const value = Math.max(0, Number(row.quantidade ?? 0) * Number(row.preco_medio ?? 0));
    const country = isBrazilSymbol(symbol) || String(row.moeda || "BRL").toUpperCase() === "BRL" ? "BR" : "US";
    return { value, country };
  });
  const sorted = [...normalized].sort((a, b) => b.value - a.value);
  const top1Pct = ((sorted[0]?.value ?? 0) / totalValue) * 100;
  const top5Pct = (sorted.slice(0, 5).reduce((acc, row) => acc + row.value, 0) / totalValue) * 100;
  const brExposurePct = (normalized.filter((row) => row.country === "BR").reduce((acc, row) => acc + row.value, 0) / totalValue) * 100;
  return {
    riskScore: 55 + Math.min(35, top5Pct * 0.25),
    top1Pct,
    top5Pct,
    brExposurePct,
    usExposurePct: 100 - brExposurePct,
  };
}

function buildGeneratedFeed({ positions = [], watchlist = [], date = new Date() }) {
  const profile = buildProfileFromPositions(positions);
  const dateKey = normalizedDayKey(date);
  const watchlistSet = new Set((watchlist || []).map((item) => String(item.symbol || "").toUpperCase()));
  const candidates = [];

  RADAR_UNIVERSE.forEach((asset) => {
    const seed = hashString(`${asset.symbol}:${dateKey}`);
    const metrics = {
      return_30d: ((seed % 300) / 10) - 8,
      return_6m: ((seed % 900) / 10) - 20,
      vol_30d: ((seed % 250) / 100) + 0.8,
      range_30d: ((seed % 320) / 10) + 8,
      pos_days_30d: (seed % 18) + 9,
      max52w_distance: ((seed % 160) / 10) - 5,
      drawdown_6m: -((seed % 420) / 10),
    };

    const rules = {
      momentum: metrics.return_6m > 15 && metrics.return_30d > 4,
      new_high: metrics.max52w_distance >= -1.5 && metrics.return_6m > 10,
      drawdown: metrics.drawdown_6m <= -30 && asset.liquidityScore >= 80,
      dividends: asset.dividendProfile,
      low_vol: metrics.vol_30d <= 1.6,
      intl_diversification: profile.brExposurePct > 70 && asset.country === "US",
    };

    Object.entries(rules).forEach(([signalType, active]) => {
      if (!active) return;
      const signalMeta = getSignalMeta(signalType);
      candidates.push({
        id: `${dateKey}-${signalType}-${asset.symbol}`,
        feed_date: dateKey,
        signal_type: signalType,
        signalType,
        signalTitle: signalMeta.title,
        signalDescription: signalMeta.description,
        symbol: asset.symbol,
        name: asset.name,
        country: asset.country,
        countryName: COUNTRY_LABELS[asset.country],
        countryFlag: COUNTRY_FLAGS[asset.country],
        assetType: asset.assetType,
        sector: asset.sector,
        rankScore: asset.liquidityScore + metrics.return_6m * 0.3 + (watchlistSet.has(asset.symbol) ? 10 : 0),
        metrics,
        reasons: reasonsFromMetrics(signalType, metrics, []),
      });
    });
  });

  const grouped = new Map();
  SIGNAL_ORDER.forEach((signalType) => {
    const meta = getSignalMeta(signalType);
    grouped.set(signalType, { ...meta, items: [] });
  });

  dedupeByPrimarySignal(
    candidates
      .sort((a, b) => b.rankScore - a.rankScore)
      .slice(0, 25),
  ).forEach((item) => {
      const radarState = "entered_today";
      grouped.get(item.signalType)?.items.push({
        ...item,
        watchlistedByUser: watchlistSet.has(item.symbol),
        radarState,
        radarStateLabel: radarStateLabel(radarState),
        radarStateEmoji: radarStateEmoji(radarState),
        stateTooltip: stateTooltip({ radarState }),
      });
    });

  const sections = [...grouped.values()].map((section) => ({
    ...section,
    items: [...section.items].sort((a, b) => {
      if (a.watchlistedByUser !== b.watchlistedByUser) return a.watchlistedByUser ? -1 : 1;
      return b.rankScore - a.rankScore;
    }),
    count: section.items.length,
    emptyMessage: "Nenhum ativo entrou nesse sinal hoje.",
  }));

  const totalItems = sections.reduce((acc, section) => acc + section.items.length, 0);
  return {
    date: dateKey,
    updatedAt: new Date().toISOString(),
    summary: {
      headline: totalItems > 0 ? "Hoje o mercado mostrou novos sinais para acompanhar." : "Hoje o mercado ficou mais estavel para acompanhar.",
      enteredCount: totalItems,
      stayedCount: 0,
      exitedCount: 0,
      totalItems,
      topSignals: sections.filter((s) => s.items.length > 0).map((s) => ({ title: s.title, count: s.items.length })).slice(0, 3),
      exitedPreview: [],
      exitedText: "",
      text: totalItems > 0 ? `Hoje ${totalItems} ativos entraram no radar para acompanhamento.` : "Hoje nao houve novos sinais relevantes nos filtros atuais.",
    },
    sections,
    exitedItems: [],
    items: sections.flatMap((section) => section.items),
    disclaimer: "Detector de sinais para acompanhamento. Nao e recomendacao de investimento.",
    profile,
  };
}

export async function getRadarFeedForUser({ userId, positions = [], date = new Date(), rangeDays = 1 }) {
  const dateKey = normalizedDayKey(date);
  const normalizedRangeDays = Math.max(1, Number(rangeDays || 1));
  const startDateKey = shiftDayKey(dateKey, -(normalizedRangeDays - 1));
  const watchlist = userId ? await listUserWatchlist({ userId }) : [];
  const watchlistSet = new Set((watchlist || []).map((item) => String(item.symbol || "").toUpperCase()));

  if (userId) {
    try {
      const feedRows = await listFeedRowsByDate({ userId, dateKey });
      const latestFeed = feedRows[0] ?? null;
      const currentFeed =
        feedRows.find((row) => Number(row?.total_assets ?? 0) > 0) ??
        latestFeed;
      const previousFeed = currentFeed
        ? feedRows.find((row) => String(row.feed_date || "") < String(currentFeed.feed_date || ""))
        : null;
      if (currentFeed) {
        const currentItems = await listRadarItems({ userId, feedDate: currentFeed.feed_date });
        const previousItems = previousFeed ? await listRadarItems({ userId, feedDate: previousFeed.feed_date }) : [];

        let hydrated = applyStatesAndSections({
          dateKey: currentFeed.feed_date,
          currentItems,
          previousItems,
          watchlistSet,
          feedUpdatedAt: currentFeed.updated_at ?? currentFeed.created_at,
        });

        if (normalizedRangeDays > 1) {
          const rangeFeeds = await listFeedRowsByRange({
            userId,
            startDateKey,
            endDateKey: currentFeed.feed_date,
          });
          const rangeDates = rangeFeeds.map((row) => row.feed_date);
          const rangeItems = await listRadarItemsByDates({ userId, feedDates: rangeDates });
          const currentSymbols = new Set((hydrated.items || []).map((item) => String(item.symbol || "").toUpperCase()));

          const extraExited = dedupeByPrimarySignal(
            rangeItems.filter((row) => !currentSymbols.has(String(row.symbol || "").toUpperCase())),
          )
            .map((row) => {
              const base = createBaseItem(row, watchlistSet);
              const radarState = "exited";
              return {
                ...base,
                id: `window-exited-${base.signalType}-${base.symbol}`,
                radarState,
                radarStateLabel: radarStateLabel(radarState),
                radarStateEmoji: radarStateEmoji(radarState),
                stateTooltip: stateTooltip({ radarState }),
              };
            })
            .sort((a, b) => b.rankScore - a.rankScore)
            .slice(0, 8);

          const mergedExitedMap = new Map();
          [...(hydrated.exitedItems || []), ...extraExited].forEach((item) => {
            const key = `${item.signalType}:${item.symbol}`;
            if (!mergedExitedMap.has(key)) mergedExitedMap.set(key, item);
          });
          const mergedExitedItems = [...mergedExitedMap.values()].slice(0, 10);

          hydrated = {
            ...hydrated,
            exitedItems: mergedExitedItems,
            summary: {
              ...hydrated.summary,
              exitedCount: mergedExitedItems.length,
              exitedPreview: mergedExitedItems.slice(0, 3).map((item) => ({
                symbol: item.symbol,
                text:
                  item.signalType === "momentum"
                    ? "saiu da tendencia"
                    : item.signalType === "new_high"
                      ? "perdeu maxima recente"
                      : item.signalType === "drawdown"
                        ? "deixou de atender queda relevante"
                        : item.signalType === "dividends"
                          ? "saiu da leitura de dividendos"
                          : "volatilidade mudou",
              })),
              exitedText: mergedExitedItems.length > 0 ? `${mergedExitedItems.length} ativos deixaram o radar no periodo.` : "",
            },
          };
        }

        const staleDays = dayDistance(currentFeed.feed_date, dateKey);
        const usedFallbackFeed = Boolean(latestFeed && currentFeed && latestFeed.feed_date !== currentFeed.feed_date);

        return {
          ...hydrated,
          watchlist,
          profile: currentFeed.profile_json ?? null,
          selectedDate: currentFeed.feed_date,
          rangeDays: normalizedRangeDays,
          freshness: {
            staleDays,
            latestFeedDate: latestFeed?.feed_date ?? null,
            usedFeedDate: currentFeed.feed_date,
            usedFallbackFeed,
          },
          summary: {
            ...hydrated.summary,
            text: currentFeed.summary || hydrated.summary.text,
            headline: hydrated.summary.headline,
          },
        };
      }
    } catch (error) {
      console.warn("[radar] falha ao carregar feed persistido, usando fallback:", error?.message || error);
    }
  }

  const generated = buildGeneratedFeed({ positions, watchlist, date });
  return { ...generated, watchlist, selectedDate: dateKey, rangeDays: normalizedRangeDays };
}

export async function addAssetToWatchlist({ userId, symbol, source = "radar" }) {
  const normalizedUserId = String(userId || "").trim();
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  if (!normalizedUserId || !normalizedSymbol) {
    throw new Error("userId e symbol sao obrigatorios para watchlist.");
  }
  const { error } = await supabase
    .from(WATCHLIST_TABLE)
    .upsert(
      {
        user_id: normalizedUserId,
        symbol: normalizedSymbol,
        source,
      },
      { onConflict: "user_id,symbol" },
    );
  if (error) throw error;
}

export async function removeAssetFromWatchlist({ userId, symbol }) {
  const normalizedUserId = String(userId || "").trim();
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  if (!normalizedUserId || !normalizedSymbol) {
    throw new Error("userId e symbol sao obrigatorios para remover da watchlist.");
  }
  const { error } = await supabase
    .from(WATCHLIST_TABLE)
    .delete()
    .eq("user_id", normalizedUserId)
    .eq("symbol", normalizedSymbol);
  if (error) throw error;
}

export async function createRadarPriceAlert({ userId, symbol, targetPrice, direction = "above" }) {
  const normalizedUserId = String(userId || "").trim();
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const parsedTarget = Number(targetPrice);
  if (!normalizedUserId || !normalizedSymbol || !Number.isFinite(parsedTarget) || parsedTarget <= 0) {
    throw new Error("Dados invalidos para criar alerta de preco.");
  }
  const { error } = await supabase.from(ALERTS_TABLE).insert({
    user_id: normalizedUserId,
    symbol: normalizedSymbol,
    target_price: parsedTarget,
    direction,
    is_active: true,
  });
  if (error) throw error;
}

export function getCountryFlagCode(country) {
  return COUNTRY_FLAGS[country] ?? "BR";
}
