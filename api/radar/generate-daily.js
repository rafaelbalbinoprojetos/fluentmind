/* eslint-env node */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BRAPI_URL = (process.env.BRAPI_URL || "https://brapi.dev/api/quote").trim();
const BRAPI_TOKEN = (process.env.BRAPI_TOKEN || "").trim();
const RADAR_CRON_SECRET = String(process.env.RADAR_CRON_SECRET || process.env.CRON_SECRET || "").trim();

const RADAR_SCAN_BATCH = Math.max(10, Math.min(120, Number(process.env.RADAR_SCAN_BATCH || 40)));
const RADAR_MIN_AVG_VOLUME = Math.max(1000, Number(process.env.RADAR_MIN_AVG_VOLUME || 100000));
const RADAR_CALL_DELAY_MS = Math.max(0, Number(process.env.RADAR_CALL_DELAY_MS || 180));
const USER_AGENT = "KORDEN/1.0 (+https://grana.app)";

const SIGNAL_TITLE_MAP = {
  momentum: "Tendencia Forte",
  new_high: "Nova Maxima Anual",
  drawdown: "Queda Relevante",
  dividends: "Dividendos Consistentes",
  low_vol: "Baixa Volatilidade",
  intl_diversification: "Diversificacao Internacional",
};

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
    : null;

let radarDailySchemaCache = null;

function getRequestParam(req, key) {
  const queryValue = req?.query?.[key];
  if (Array.isArray(queryValue)) return queryValue[0];
  if (queryValue !== undefined) return queryValue;
  const bodyValue = req?.body?.[key];
  if (Array.isArray(bodyValue)) return bodyValue[0];
  return bodyValue;
}

function parseRuntimeOptions(req) {
  const batchRaw = Number(getRequestParam(req, "batch"));
  const batchSize =
    Number.isFinite(batchRaw) && batchRaw > 0
      ? Math.max(1, Math.min(120, Math.round(batchRaw)))
      : RADAR_SCAN_BATCH;

  const tickersRaw = String(getRequestParam(req, "tickers") || "")
    .split(",")
    .map((value) => normalizeBRTicker(value))
    .filter(Boolean);

  const signalDateRaw = String(getRequestParam(req, "date") || "").trim();
  const signalDate = /^\d{4}-\d{2}-\d{2}$/.test(signalDateRaw) ? signalDateRaw : todayKey();

  return {
    batchSize,
    tickerOverrides: [...new Set(tickersRaw)],
    signalDate,
  };
}

function todayKey() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
}

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function authorized(req) {
  if (!RADAR_CRON_SECRET) return true;
  const authHeader = String(req.headers?.authorization || req.headers?.Authorization || "").trim();
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const isCronHeader = Boolean(req.headers?.["x-vercel-cron"]);
  return isCronHeader || token === RADAR_CRON_SECRET;
}

function normalizeBRTicker(rawTicker) {
  return String(rawTicker || "")
    .trim()
    .toUpperCase()
    .replace(/\.SA$/i, "")
    .replace(/\s+/g, "");
}

function toStorageSymbol(rawTicker) {
  const ticker = normalizeBRTicker(rawTicker);
  return ticker ? `${ticker}.SA` : "";
}

function movingAverage(values, periods) {
  if (!Array.isArray(values) || values.length < periods || periods <= 0) return null;
  const window = values.slice(-periods);
  return window.reduce((acc, v) => acc + v, 0) / window.length;
}

function computeRollingMetrics(prices = []) {
  if (!Array.isArray(prices) || prices.length < 2) {
    return {
      return30d: null,
      return6m: null,
      vol30d: null,
      range30d: null,
      posDays30d: null,
      drawdown6m: null,
      sma200: null,
      high52w: null,
      low52w: null,
    };
  }

  const recent30 = prices.slice(-30);
  const recent126 = prices.slice(-126);
  const recent252 = prices.slice(-252);

  const first30 = recent30[0];
  const last30 = recent30[recent30.length - 1];
  const return30d = first30 > 0 ? ((last30 / first30) - 1) * 100 : null;

  const first126 = recent126[0];
  const last126 = recent126[recent126.length - 1];
  const return6m = first126 > 0 ? ((last126 / first126) - 1) * 100 : null;

  const max30 = Math.max(...recent30);
  const min30 = Math.min(...recent30);
  const range30d = min30 > 0 ? ((max30 / min30) - 1) * 100 : null;

  const returns30 = [];
  let posDays30d = 0;
  for (let i = 1; i < recent30.length; i += 1) {
    const prev = recent30[i - 1];
    const current = recent30[i];
    if (prev > 0) {
      const ret = ((current / prev) - 1) * 100;
      returns30.push(ret);
      if (ret > 0) posDays30d += 1;
    }
  }

  const mean = returns30.length > 0 ? returns30.reduce((acc, v) => acc + v, 0) / returns30.length : null;
  const variance =
    returns30.length > 1 && mean !== null
      ? returns30.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (returns30.length - 1)
      : null;
  const vol30d = variance !== null ? Math.sqrt(variance) : null;

  const peak6m = Math.max(...recent126);
  const drawdown6m = peak6m > 0 ? ((last126 / peak6m) - 1) * 100 : null;

  const high52w = Math.max(...recent252);
  const low52w = Math.min(...recent252);

  return {
    return30d,
    return6m,
    vol30d,
    range30d,
    posDays30d,
    drawdown6m,
    sma200: movingAverage(prices, 200),
    high52w,
    low52w,
  };
}

async function fetchBrapiSnapshot(rawTicker) {
  const ticker = normalizeBRTicker(rawTicker);
  if (!ticker) throw new Error("Ticker invalido");

  const params = new URLSearchParams({
    range: "1y",
    interval: "1d",
    fundamental: "false",
    dividends: "false",
  });
  if (BRAPI_TOKEN) params.set("token", BRAPI_TOKEN);

  const url = `${BRAPI_URL}/${encodeURIComponent(ticker)}?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`BRAPI ${ticker}: ${response.status} ${details}`);
  }

  const payload = await response.json();
  const quote = payload?.results?.[0];
  if (!quote) throw new Error(`BRAPI sem resultado para ${ticker}`);

  const price =
    toNumber(quote.regularMarketPrice) ??
    toNumber(quote.regularMarketPreviousClose) ??
    toNumber(quote.regularMarketDayHigh) ??
    toNumber(quote.regularMarketDayLow) ??
    toNumber(quote.regularMarketOpen);

  if (!price || price <= 0) {
    throw new Error(`BRAPI preco invalido para ${ticker}`);
  }

  const historyRaw = Array.isArray(quote.historicalDataPrice) ? quote.historicalDataPrice : [];
  const historyPrices = historyRaw
    .map((row) => toNumber(row?.close))
    .filter((v) => Number.isFinite(v) && v > 0);

  return {
    ticker,
    symbol: toStorageSymbol(ticker),
    source: "brapi",
    price,
    prevClose: toNumber(quote.regularMarketPreviousClose),
    changePct: toNumber(quote.regularMarketChangePercent),
    volume: toNumber(quote.regularMarketVolume),
    avgVolume: toNumber(quote.averageDailyVolume10Day) ?? toNumber(quote.averageDailyVolume3Month),
    high52wQuote: toNumber(quote.fiftyTwoWeekHigh),
    low52wQuote: toNumber(quote.fiftyTwoWeekLow),
    longName: quote.longName || quote.shortName || null,
    historyPrices,
  };
}

function isDividendProfile(asset) {
  const sector = String(asset.sector || "").toLowerCase();
  const name = String(asset.name || "").toLowerCase();
  const ticker = normalizeBRTicker(asset.ticker);
  return (
    sector.includes("fii") ||
    name.includes("fundo") ||
    name.includes("imobili") ||
    ticker.endsWith("11")
  );
}

function computeSignalRows(asset, snapshot, signalDate) {
  const rows = [];
  const rolling = computeRollingMetrics(snapshot.historyPrices || []);

  const price = Number(snapshot.price);
  const prevClose = Number(snapshot.prevClose);
  const avgVolume = Number(snapshot.avgVolume);
  const volume = Number(snapshot.volume);

  const changePct =
    Number.isFinite(snapshot.changePct)
      ? snapshot.changePct
      : Number.isFinite(prevClose) && prevClose > 0
        ? ((price / prevClose) - 1) * 100
        : null;

  const high52w = Number.isFinite(rolling.high52w) ? rolling.high52w : snapshot.high52wQuote;
  const low52w = Number.isFinite(rolling.low52w) ? rolling.low52w : snapshot.low52wQuote;

  const riseFromLow = Number.isFinite(low52w) && low52w > 0 ? ((price / low52w) - 1) * 100 : null;
  const drawdownFromHigh = Number.isFinite(high52w) && high52w > 0 ? ((price / high52w) - 1) * 100 : null;
  const max52wDistance = Number.isFinite(high52w) && high52w > 0 ? ((price / high52w) - 1) * 100 : null;
  const volumeBoost =
    Number.isFinite(volume) && Number.isFinite(avgVolume) && avgVolume > 0
      ? ((volume - avgVolume) / avgVolume) * 100
      : null;

  const hasAvgVolume = Number.isFinite(avgVolume) && avgVolume > 0;
  const hasDayVolume = Number.isFinite(volume) && volume > 0;
  const liquidEnough = hasAvgVolume
    ? avgVolume >= RADAR_MIN_AVG_VOLUME
    : hasDayVolume
      ? volume >= Math.max(1000, Math.round(RADAR_MIN_AVG_VOLUME * 0.2))
      : true;
  const above200 = Number.isFinite(rolling.sma200) ? price > rolling.sma200 : null;

  const baseMetrics = {
    price,
    change_pct: changePct,
    return_30d: rolling.return30d,
    return_6m: rolling.return6m,
    vol_30d: rolling.vol30d,
    range_30d: rolling.range30d,
    pos_days_30d: rolling.posDays30d,
    drawdown_6m: rolling.drawdown6m,
    max52w_distance: max52wDistance,
    high52w,
    low52w,
    volume,
    avg_volume: avgVolume,
    volume_boost_pct: volumeBoost,
    above_sma_200: above200,
    source: snapshot.source,
  };

  const momentumActive =
    liquidEnough &&
    above200 !== false &&
    (
      (Number.isFinite(rolling.return6m) && rolling.return6m >= 8) ||
      (Number.isFinite(rolling.return30d) && rolling.return30d >= 4)
    ) &&
    (!Number.isFinite(volumeBoost) || volumeBoost >= -20);

  if (momentumActive) {
    rows.push({
      signal_date: signalDate,
      symbol: snapshot.symbol,
      signal_type: "momentum",
      score: Math.min(100, 55 + (rolling.return6m || 0) * 0.6 + Math.max(0, volumeBoost || 0) * 0.1),
      reasons_json: [
        `${(rolling.return6m || 0).toFixed(1)}% em 6 meses`,
        "acima da media de 200 periodos",
        Number.isFinite(volumeBoost) ? `volume ${volumeBoost >= 0 ? "+" : ""}${volumeBoost.toFixed(0)}% vs media` : "volume consistente",
      ],
      metrics_json: baseMetrics,
    });
  }

  const newHighActive = liquidEnough && Number.isFinite(max52wDistance) && max52wDistance >= -3.0;
  if (newHighActive) {
    rows.push({
      signal_date: signalDate,
      symbol: snapshot.symbol,
      signal_type: "new_high",
      score: 78,
      reasons_json: [
        "rompeu/encostou na maxima de 52 semanas",
        Number.isFinite(rolling.return30d) ? `${rolling.return30d.toFixed(1)}% em 30 dias` : "movimento recente positivo",
        "liquidez suficiente para acompanhamento",
      ],
      metrics_json: baseMetrics,
    });
  }

  const drawdownActive = liquidEnough && Number.isFinite(drawdownFromHigh) && drawdownFromHigh <= -20;
  const softDrawdownActive =
    liquidEnough &&
    !drawdownActive &&
    (
      (Number.isFinite(drawdownFromHigh) && drawdownFromHigh <= -12) ||
      (Number.isFinite(rolling.return6m) && rolling.return6m <= -10) ||
      (Number.isFinite(rolling.return30d) && rolling.return30d <= -6 && above200 === false)
    );

  if (drawdownActive || softDrawdownActive) {
    const drawdownRef = Number.isFinite(drawdownFromHigh) ? Math.abs(drawdownFromHigh) : Math.abs(rolling.return6m || 0);
    rows.push({
      signal_date: signalDate,
      symbol: snapshot.symbol,
      signal_type: "drawdown",
      score: drawdownActive ? Math.min(95, drawdownRef) : Math.min(82, 40 + drawdownRef * 1.2),
      reasons_json: [
        Number.isFinite(drawdownFromHigh)
          ? `${Math.abs(drawdownFromHigh).toFixed(1)}% abaixo da maxima de 52 semanas`
          : "queda relevante em janela recente",
        Number.isFinite(rolling.return6m) ? `${rolling.return6m.toFixed(1)}% em 6 meses` : "pressao de preco acumulada",
        "liquidez relevante mantida",
        "movimento que pede contexto antes de agir",
      ],
      metrics_json: baseMetrics,
    });
  }

  if (isDividendProfile(asset) && liquidEnough) {
    rows.push({
      signal_date: signalDate,
      symbol: snapshot.symbol,
      signal_type: "dividends",
      score: 62,
      reasons_json: [
        "perfil de pagamento recorrente observado",
        "liquidez adequada para acompanhamento",
        "movimento para monitorar no longo prazo",
      ],
      metrics_json: baseMetrics,
    });
  }

  const lowVolActive =
    liquidEnough &&
    (
      (Number.isFinite(rolling.vol30d) && rolling.vol30d <= 2.6) ||
      (
        Number.isFinite(rolling.range30d) &&
        rolling.range30d <= 18 &&
        Number.isFinite(rolling.posDays30d) &&
        rolling.posDays30d >= 12
      )
    );
  if (lowVolActive) {
    rows.push({
      signal_date: signalDate,
      symbol: snapshot.symbol,
      signal_type: "low_vol",
      score: 60,
      reasons_json: [
        `volatilidade 30d: ${rolling.vol30d.toFixed(2)}% ao dia`,
        Number.isFinite(rolling.range30d) ? `amplitude 30d: ${rolling.range30d.toFixed(1)}%` : "amplitude sob observacao",
        Number.isFinite(rolling.posDays30d) ? `dias positivos (30d): ${Math.round(rolling.posDays30d)}/30` : "consistencia de movimento",
      ],
      metrics_json: baseMetrics,
    });
  }

  return rows;
}

async function loadUniverseBatch({ batchSize, tickerOverrides = [] }) {
  let query = supabase
    .from("korden_universe_br")
    .select("id, ticker, name, sector, priority, is_active, last_scanned_at")
    .eq("is_active", true);

  if (tickerOverrides.length > 0) {
    query = query.in("ticker", tickerOverrides).order("ticker", { ascending: true }).limit(Math.min(120, tickerOverrides.length));
  } else {
    query = query
      .order("last_scanned_at", { ascending: true, nullsFirst: true })
      .order("priority", { ascending: true })
      .order("ticker", { ascending: true })
      .limit(batchSize);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).filter((row) => normalizeBRTicker(row.ticker));
}

async function touchScannedUniverseRows(ids = []) {
  const cleanIds = [...new Set((ids || []).map((value) => Number(value)).filter((value) => Number.isFinite(value)))];
  if (!cleanIds.length) return;

  const { error } = await supabase
    .from("korden_universe_br")
    .update({ last_scanned_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .in("id", cleanIds);

  if (error) throw error;
}

async function persistGlobalRadarRows({ signalDate, rows }) {
  const cleanRows = rows || [];
  if (!cleanRows.length) return { inserted: 0, deleted: 0 };

  const symbols = [...new Set(cleanRows.map((row) => String(row.symbol || "").toUpperCase()).filter(Boolean))];
  const tickers = [...new Set(symbols.map((symbol) => normalizeBRTicker(symbol)).filter(Boolean))];
  const schema = await getRadarDailySchema();

  let deleteQuery = supabase.from("korden_radar_daily_br").delete();
  if (schema.hasSignalDate) {
    deleteQuery = deleteQuery.eq("signal_date", signalDate);
  } else if (schema.hasRadarDate) {
    deleteQuery = deleteQuery.eq("radar_date", signalDate);
  }
  if (schema.hasSymbol) {
    deleteQuery = deleteQuery.in("symbol", symbols);
  } else if (schema.hasTicker) {
    deleteQuery = deleteQuery.in("ticker", tickers);
  }
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;

  const insertRows = cleanRows.map((row) => {
    const payload = {};
    if (schema.hasSignalDate) payload.signal_date = row.signal_date;
    if (schema.hasRadarDate) payload.radar_date = row.signal_date;
    if (schema.hasSymbol) payload.symbol = row.symbol;
    if (schema.hasTicker) payload.ticker = normalizeBRTicker(row.symbol);
    if (schema.hasSignalType) payload.signal_type = row.signal_type;
    if (schema.hasSignal) payload.signal = row.signal_type;
    if (schema.hasCategory) payload.category = row.signal_type;
    if (schema.hasScore) payload.score = row.score;
    if (schema.hasReasonsJson) payload.reasons_json = row.reasons_json || [];
    if (schema.hasMetricsJson) payload.metrics_json = row.metrics_json || {};
    if (schema.hasSource) payload.source = row.metrics_json?.source || "brapi";
    if (schema.hasUpdatedAt) payload.updated_at = new Date().toISOString();
    return payload;
  });

  const { error: insertError } = await supabase.from("korden_radar_daily_br").insert(insertRows);
  if (insertError) throw insertError;

  return { inserted: insertRows.length, deleted: symbols.length };
}

async function getRadarDailySchema() {
  if (radarDailySchemaCache) return radarDailySchemaCache;

  async function hasColumn(columnName) {
    const { error } = await supabase
      .from("korden_radar_daily_br")
      .select(columnName)
      .limit(1);
    return !error;
  }

  const cols = new Set();
  const candidates = [
    "signal_date",
    "radar_date",
    "symbol",
    "ticker",
    "signal_type",
    "signal",
    "category",
    "score",
    "reasons_json",
    "metrics_json",
    "source",
    "updated_at",
  ];

  for (const col of candidates) {
    if (await hasColumn(col)) cols.add(col);
  }

  radarDailySchemaCache = {
    hasSignalDate: cols.has("signal_date"),
    hasRadarDate: cols.has("radar_date"),
    hasSymbol: cols.has("symbol"),
    hasTicker: cols.has("ticker"),
    hasSignalType: cols.has("signal_type"),
    hasSignal: cols.has("signal"),
    hasCategory: cols.has("category"),
    hasScore: cols.has("score"),
    hasReasonsJson: cols.has("reasons_json"),
    hasMetricsJson: cols.has("metrics_json"),
    hasSource: cols.has("source"),
    hasUpdatedAt: cols.has("updated_at"),
  };

  return radarDailySchemaCache;
}

async function loadUserProfiles() {
  const { data: rows, error } = await supabase
    .from("korden_portfolio_snapshots")
    .select("user_id, risk_score, top1_pct, top5_pct, brl_pct, usd_pct, eur_pct, stocks_pct")
    .order("snapshot_date", { ascending: false });
  if (error) throw error;

  const map = new Map();
  (rows || []).forEach((row) => {
    if (!map.has(row.user_id)) map.set(row.user_id, row);
  });

  if (map.size > 0) return [...map.values()];

  const { data: carteiraUsers, error: carteiraError } = await supabase
    .from("carteira")
    .select("user_id")
    .not("user_id", "is", null)
    .limit(10000);
  if (carteiraError) throw carteiraError;

  const fallback = [...new Set((carteiraUsers || []).map((row) => row.user_id).filter(Boolean))].map((userId) => ({
    user_id: userId,
    risk_score: 55,
    top1_pct: 0,
    top5_pct: 0,
    brl_pct: 100,
    usd_pct: 0,
    eur_pct: 0,
    stocks_pct: 100,
  }));

  return fallback;
}

function buildUserRadarSelection({ profile, globalRows, universeMap, signalDate }) {
  const selected = [];
  const seen = new Set();

  function pick(signalType, filterFn, limit) {
    const pool = globalRows
      .filter((row) => row.signal_type === signalType)
      .filter((row) => filterFn(row))
      .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))
      .slice(0, limit);

    pool.forEach((row) => {
      const key = `${row.signal_type}:${row.symbol}`;
      if (seen.has(key)) return;
      seen.add(key);
      const asset = universeMap.get(row.symbol);
      selected.push({
        user_id: profile.user_id,
        feed_date: signalDate,
        symbol: row.symbol,
        name: asset?.name || row.symbol,
        country: "BR",
        asset_type: asset?.asset_type || "Acoes",
        sector: asset?.sector || null,
        signal_type: row.signal_type,
        rank_score: Number(row.score ?? 0),
        reasons_json: row.reasons_json || [],
        metrics_json: row.metrics_json || {},
      });
    });
  }

  const highRisk = Number(profile.risk_score ?? 0) >= 67;
  const concentrated = Number(profile.top5_pct ?? 0) > 60 || Number(profile.top1_pct ?? 0) > 20;

  pick("new_high", () => true, 4);
  pick("momentum", () => true, 5);
  pick("drawdown", () => true, 4);
  pick("dividends", () => true, 4);
  pick("low_vol", () => true, highRisk || concentrated ? 6 : 4);

  return selected.sort((a, b) => Number(b.rank_score) - Number(a.rank_score)).slice(0, 25);
}

async function persistUserFeeds({ signalDate, profiles, globalSignals, universeMap }) {
  let usersProcessed = 0;

  for (const profile of profiles) {
    const selected = buildUserRadarSelection({
      profile,
      globalRows: globalSignals,
      universeMap,
      signalDate,
    });

    const countsMap = new Map();
    selected.forEach((item) => {
      countsMap.set(item.signal_type, (countsMap.get(item.signal_type) ?? 0) + 1);
    });

    const topSignals = [...countsMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([signalType, count]) => ({
        signalType,
        title: SIGNAL_TITLE_MAP[signalType] || "Sinal do Radar",
        count,
      }));

    const summary =
      selected.length > 0
        ? `Hoje ${selected.length} ativos entraram no radar - principalmente ${topSignals
            .slice(0, 2)
            .map((s) => s.title)
            .join(" e ")}.`
        : "Hoje nao houve ativos com sinais fortes suficientes no lote analisado.";

    const { error: deleteFeedError } = await supabase
      .from("radar_daily_feed")
      .delete()
      .eq("user_id", profile.user_id)
      .eq("feed_date", signalDate);
    if (deleteFeedError) throw deleteFeedError;

    const { error: insertFeedError } = await supabase.from("radar_daily_feed").insert({
      user_id: profile.user_id,
      feed_date: signalDate,
      headline: "Movimentos relevantes detectados para acompanhar.",
      summary,
      total_assets: selected.length,
      top_signals_json: topSignals,
      profile_json: profile,
    });
    if (insertFeedError) throw insertFeedError;

    const { error: deleteItemsError } = await supabase
      .from("radar_user_items")
      .delete()
      .eq("user_id", profile.user_id)
      .eq("feed_date", signalDate);
    if (deleteItemsError) throw deleteItemsError;

    if (selected.length > 0) {
      const { error: insertItemsError } = await supabase.from("radar_user_items").insert(selected);
      if (insertItemsError) throw insertItemsError;
    }

    usersProcessed += 1;
  }

  return usersProcessed;
}

async function runDailyRadar({ signalDate, batchSize, tickerOverrides = [] }) {
  const universe = await loadUniverseBatch({ batchSize, tickerOverrides });
  if (!universe.length) {
    return {
      ok: true,
      signalDate,
      generatedSignals: 0,
      usersProcessed: 0,
      scannedTickers: 0,
      requestedBatchSize: batchSize,
      note: "korden_universe_br vazio ou sem ativos elegiveis",
    };
  }

  const globalSignals = [];
  const scannedTickers = [];
  const scannedUniverseIds = [];
  const universeMap = new Map();
  const scanErrors = [];

  for (const asset of universe) {
    const ticker = normalizeBRTicker(asset.ticker);
    if (!ticker) continue;

    try {
      const snapshot = await fetchBrapiSnapshot(ticker);
      const rows = computeSignalRows(asset, snapshot, signalDate);
      rows.forEach((row) => globalSignals.push(row));

      universeMap.set(snapshot.symbol, {
        symbol: snapshot.symbol,
        name: asset.name || snapshot.longName || snapshot.symbol,
        sector: asset.sector || null,
        asset_type: isDividendProfile(asset) ? "FII" : "Acoes",
      });

      scannedTickers.push(ticker);
      scannedUniverseIds.push(asset.id);
    } catch (error) {
      scanErrors.push({ ticker, error: error?.message || String(error) });
      scannedTickers.push(ticker);
      scannedUniverseIds.push(asset.id);
      console.warn("[radar] falha ao escanear ticker:", ticker, error?.message || error);
    }

    if (RADAR_CALL_DELAY_MS > 0) {
      await sleep(RADAR_CALL_DELAY_MS);
    }
  }

  await touchScannedUniverseRows(scannedUniverseIds);

  let persistedDailyCount = 0;
  if (globalSignals.length > 0) {
    const persisted = await persistGlobalRadarRows({ signalDate, rows: globalSignals });
    persistedDailyCount = persisted.inserted;
  }

  const profiles = await loadUserProfiles();
  const usersProcessed = await persistUserFeeds({
    signalDate,
    profiles,
    globalSignals,
    universeMap,
  });

  return {
    ok: true,
    signalDate,
    requestedBatchSize: batchSize,
    requestedTickers: tickerOverrides,
    scannedTickers: scannedTickers.length,
    scannedTickerList: scannedTickers,
    generatedSignals: globalSignals.length,
    persistedDailyCount,
    usersProcessed,
    scanErrors: scanErrors.slice(0, 15),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Metodo nao suportado." });
  }

  if (!supabase) {
    return res.status(500).json({ ok: false, error: "Supabase service key nao configurada." });
  }

  if (!authorized(req)) {
    return res.status(401).json({ ok: false, error: "Nao autorizado para executar o cron do Radar." });
  }

  try {
    const options = parseRuntimeOptions(req);
    const result = await runDailyRadar(options);
    return res.status(200).json({ ...result, executedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[radar] erro ao gerar feed diario:", error);
    return res.status(500).json({ ok: false, error: error.message || "Falha ao gerar radar diario." });
  }
}
