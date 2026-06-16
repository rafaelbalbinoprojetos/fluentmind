/* eslint-env node */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH_SIZE = Number(process.env.YAHOO_BATCH_SIZE || 50);
const BRAPI_URL = (process.env.BRAPI_URL || "https://brapi.dev/api/quote").trim();
const BRAPI_TOKEN = (process.env.BRAPI_TOKEN || "").trim();
const YAHOO_QUOTE_URL = (process.env.YAHOO_QUOTE_URL || "https://query1.finance.yahoo.com/v7/finance/quote").trim();
const YAHOO_SEARCH_URL = (process.env.YAHOO_SEARCH_URL || "https://query1.finance.yahoo.com/v1/finance/search").trim();
const BINANCE_BASE_URL = (process.env.BINANCE_BASE_URL || "https://api.binance.com").trim();
const YAHOO_SYMBOL_ALIASES = (() => {
  const raw = process.env.YAHOO_SYMBOL_ALIASES || "";
  if (!raw.trim()) {
    return {
      STLAM: ["STLAM.MI"],
    };
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const normalized = {};
    for (const [key, value] of Object.entries(parsed)) {
      const source = String(key || "").trim().toUpperCase();
      if (!source) continue;
      const list = Array.isArray(value) ? value : [value];
      normalized[source] = list
        .map((item) => String(item || "").trim().toUpperCase())
        .filter(Boolean);
    }
    return normalized;
  } catch (error) {
    console.warn("[update-quotes] YAHOO_SYMBOL_ALIASES invalido:", error?.message || error);
    return {};
  }
})();

if (supabaseServiceKey) {
  try {
    const payloadSegment = supabaseServiceKey.split(".")[1];
    const payload = JSON.parse(Buffer.from(payloadSegment, "base64").toString("utf8"));
    console.log("[update-quotes] Supabase service key role:", payload.role);
  } catch (error) {
    console.warn("[update-quotes] Nao foi possivel inspecionar SUPABASE_SERVICE_KEY:", error?.message || error);
  }
}

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
    : null;

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function toISODate(value = Date.now()) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

async function fetchQuotes(symbols) {
  if (!symbols.length) {
    return { quotes: [], unauthorizedSymbols: [] };
  }

  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "KORDEN/1.0 (+https://grana.app)",
  };

  const results = [];
  const unauthorizedSymbols = new Set();
  const binanceHeaders = {
    "Content-Type": "application/json",
    "User-Agent": "KORDEN/1.0 (+https://grana.app)",
  };

  const CRYPTO_QUOTE_ASSETS = new Set(["USD", "USDT", "BRL", "EUR"]);

  function parseCryptoSymbol(inputSymbol) {
    const normalized = String(inputSymbol || "").trim().toUpperCase();
    if (!normalized) return null;
    if (normalized.includes(".SA")) return null;

    if (normalized.includes("-")) {
      const [base, quote] = normalized.split("-", 2);
      if (!base) return null;
      const q = quote && CRYPTO_QUOTE_ASSETS.has(quote) ? quote : "USD";
      return { base, quote: q };
    }

    if (normalized.includes("/")) {
      const [base, quote] = normalized.split("/", 2);
      if (!base) return null;
      const q = quote && CRYPTO_QUOTE_ASSETS.has(quote) ? quote : "USD";
      return { base, quote: q };
    }

    // Ex.: BTCUSDT, ETHUSD, BTCBRL
    for (const quoteAsset of ["USDT", "USD", "BRL", "EUR"]) {
      if (normalized.endsWith(quoteAsset) && normalized.length > quoteAsset.length) {
        return {
          base: normalized.slice(0, -quoteAsset.length),
          quote: quoteAsset === "USDT" ? "USD" : quoteAsset,
        };
      }
    }

    // Ex.: BTC, ETH, SOL
    if (/^[A-Z0-9]{2,12}$/.test(normalized)) {
      return { base: normalized, quote: "USD" };
    }

    return null;
  }

  async function fetchBinanceTicker(symbol) {
    const url = `${BINANCE_BASE_URL}/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;
    const response = await fetch(url, { headers: binanceHeaders });
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Binance ${symbol}: ${response.status} ${details}`);
    }
    const payload = await response.json();
    const lastPrice = Number(payload?.lastPrice ?? null);
    const changePercent = Number(payload?.priceChangePercent ?? null);
    const closeTime = Number(payload?.closeTime ?? null);
    if (!Number.isFinite(lastPrice) || lastPrice <= 0) {
      throw new Error(`Binance preco invalido para ${symbol}`);
    }
    return {
      lastPrice,
      changePercent: Number.isFinite(changePercent) ? changePercent : null,
      closeTime: Number.isFinite(closeTime) ? closeTime : Date.now(),
    };
  }

  async function fetchCryptoFallback(symbol) {
    const parsed = parseCryptoSymbol(symbol);
    if (!parsed) {
      throw new Error(`Simbolo nao elegivel para fallback cripto: ${symbol}`);
    }

    const base = parsed.base;
    const desiredQuote = parsed.quote;

    // 1) Tenta par direto desejado
    if (desiredQuote === "BRL") {
      try {
        const direct = await fetchBinanceTicker(`${base}BRL`);
        return {
          symbol,
          regularMarketPrice: direct.lastPrice,
          regularMarketChange: null,
          regularMarketChangePercent: direct.changePercent,
          currency: "BRL",
          regularMarketTime: Math.floor(direct.closeTime / 1000),
          source: "binance-public",
          sourceSymbol: `${base}BRL`,
        };
      } catch {}
    }

    if (desiredQuote === "EUR") {
      try {
        const direct = await fetchBinanceTicker(`${base}EUR`);
        return {
          symbol,
          regularMarketPrice: direct.lastPrice,
          regularMarketChange: null,
          regularMarketChangePercent: direct.changePercent,
          currency: "EUR",
          regularMarketTime: Math.floor(direct.closeTime / 1000),
          source: "binance-public",
          sourceSymbol: `${base}EUR`,
        };
      } catch {}
    }

    // 2) Fallback padrão via USDT (tratado como USD)
    const usdtPair = await fetchBinanceTicker(`${base}USDT`);
    if (desiredQuote === "BRL") {
      try {
        const usdtBrl = await fetchBinanceTicker("USDTBRL");
        return {
          symbol,
          regularMarketPrice: usdtPair.lastPrice * usdtBrl.lastPrice,
          regularMarketChange: null,
          regularMarketChangePercent: usdtPair.changePercent,
          currency: "BRL",
          regularMarketTime: Math.floor(usdtPair.closeTime / 1000),
          source: "binance-public",
          sourceSymbol: `${base}USDT`,
        };
      } catch {
        // se não conseguir converter para BRL, devolve em USD
      }
    }

    return {
      symbol,
      regularMarketPrice: usdtPair.lastPrice,
      regularMarketChange: null,
      regularMarketChangePercent: usdtPair.changePercent,
      currency: "USD",
      regularMarketTime: Math.floor(usdtPair.closeTime / 1000),
      source: "binance-public",
      sourceSymbol: `${base}USDT`,
    };
  }

  function parseYahooQuote(quote, requestedSymbol, resolvedSymbol) {
    const lastPriceRaw =
      quote.regularMarketPrice ??
      quote.regularMarketPreviousClose ??
      quote.regularMarketDayHigh ??
      quote.regularMarketDayLow ??
      quote.regularMarketOpen ??
      null;
    const lastPrice = Number(lastPriceRaw);

    if (!Number.isFinite(lastPrice) || lastPrice <= 0) {
      throw new Error(`Fallback Yahoo preco invalido para ${resolvedSymbol || requestedSymbol}`);
    }

    const changePercentRaw =
      quote.regularMarketChangePercent ??
      (Number.isFinite(Number(quote.regularMarketChange))
        ? Number(quote.regularMarketChange)
        : (Number.isFinite(lastPrice) && Number.isFinite(Number(quote.regularMarketPreviousClose ?? null))
          ? ((lastPrice - Number(quote.regularMarketPreviousClose)) / Number(quote.regularMarketPreviousClose)) * 100
          : null));

    return {
      symbol: requestedSymbol,
      regularMarketPrice: lastPrice,
      regularMarketChange: Number(quote.regularMarketChange ?? null),
      regularMarketChangePercent: Number.isFinite(changePercentRaw) ? Number(changePercentRaw) : null,
      currency: quote.currency ?? "BRL",
      regularMarketTime: Number.isFinite(Number(quote.regularMarketTime))
        ? Number(quote.regularMarketTime)
        : Math.floor(Date.now() / 1000),
      source: "yahoo-finance",
      sourceSymbol: resolvedSymbol || quote.symbol || requestedSymbol,
    };
  }

  async function fetchYahooQuoteBySymbol(requestedSymbol, resolvedSymbol) {
    const lookupSymbol = resolvedSymbol || requestedSymbol;
    const url = `${YAHOO_QUOTE_URL}?symbols=${encodeURIComponent(lookupSymbol)}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Falha no fallback Yahoo ${lookupSymbol}: ${response.status} ${details}`);
    }

    const payload = await response.json();
    const quote = payload?.quoteResponse?.result?.[0];
    if (!quote) {
      throw new Error(`Fallback Yahoo sem resultado para ${lookupSymbol}`);
    }
    return parseYahooQuote(quote, requestedSymbol, lookupSymbol);
  }

  function buildYahooCandidates(requestedSymbol) {
    const normalized = String(requestedSymbol || "").trim().toUpperCase();
    const aliases = YAHOO_SYMBOL_ALIASES[normalized] || [];
    const candidates = [normalized];
    if (normalized.endsWith(".SA")) {
      candidates.push(normalized.slice(0, -3));
    }
    aliases.forEach((alias) => candidates.push(alias));
    return [...new Set(candidates.filter(Boolean))];
  }

  async function searchYahooCandidates(requestedSymbol) {
    const url = `${YAHOO_SEARCH_URL}?q=${encodeURIComponent(requestedSymbol)}&quotesCount=8&newsCount=0`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Falha na busca Yahoo ${requestedSymbol}: ${response.status} ${details}`);
    }
    const payload = await response.json();
    const quotes = Array.isArray(payload?.quotes) ? payload.quotes : [];
    const normalized = String(requestedSymbol || "").trim().toUpperCase();
    const ranked = quotes
      .map((entry) => ({
        symbol: String(entry?.symbol || "").trim().toUpperCase(),
        quoteType: String(entry?.quoteType || "").trim().toUpperCase(),
      }))
      .filter((entry) => entry.symbol);
    const preferred = ranked
      .filter((entry) => entry.quoteType === "EQUITY")
      .sort((a, b) => {
        const aStarts = a.symbol.startsWith(normalized) ? 1 : 0;
        const bStarts = b.symbol.startsWith(normalized) ? 1 : 0;
        return bStarts - aStarts;
      })
      .map((entry) => entry.symbol);
    return [...new Set(preferred)];
  }

  async function fetchYahooFallback(symbol) {
    const baseCandidates = buildYahooCandidates(symbol);

    for (const candidate of baseCandidates) {
      try {
        return await fetchYahooQuoteBySymbol(symbol, candidate);
      } catch (error) {
        console.warn(`[yahoo-fallback] tentativa direta falhou ${symbol} -> ${candidate}:`, error?.message || error);
      }
    }

    const searchedSymbols = await searchYahooCandidates(symbol);
    for (const candidate of searchedSymbols) {
      try {
        return await fetchYahooQuoteBySymbol(symbol, candidate);
      } catch (error) {
        console.warn(`[yahoo-fallback] tentativa de busca falhou ${symbol} -> ${candidate}:`, error?.message || error);
      }
    }

    throw new Error(`Nenhuma cotacao valida encontrada no Yahoo para ${symbol}`);
  }

  for (const symbol of symbols) {
    let shouldTryYahooFallback = false;
    let unauthorizedByBrapi = false;
    try {
      // brapi espera o ticker sem sufixo .SA na maioria dos casos
      const brapiSymbol = symbol.endsWith(".SA") ? symbol.slice(0, -3) : symbol;
      const params = new URLSearchParams({ range: "1d", interval: "1d" });
      if (BRAPI_TOKEN) params.set("token", BRAPI_TOKEN);
      const url = `${BRAPI_URL}/${encodeURIComponent(brapiSymbol)}?${params.toString()}`;
      console.log("[brapi] solicitando", { symbol, brapiSymbol, url, hasToken: Boolean(BRAPI_TOKEN) });
      const response = await fetch(url, { headers });

      if (response.status === 401 || response.status === 403) {
        unauthorizedByBrapi = true;
        console.warn("[brapi] nao autorizado", symbol, response.status);
        shouldTryYahooFallback = true;
        throw new Error(`brapi unauthorized ${response.status}`);
      }

      if (!response.ok) {
        const details = await response.text();
        console.warn(`[brapi] falha ${symbol}: ${response.status} ${details}`);
        shouldTryYahooFallback = true;
        throw new Error(`brapi failed ${response.status}`);
      }

      const payload = await response.json();
      const quote = payload?.results?.[0];
      if (!quote) {
        shouldTryYahooFallback = true;
        throw new Error("brapi sem quote");
      }

      console.log("[brapi] resposta", {
        symbol,
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
        time: quote.regularMarketTime,
      });

      const lastPriceRaw =
        quote.regularMarketPrice ??
        quote.regularMarketPreviousClose ??
        quote.regularMarketDayHigh ??
        quote.regularMarketDayLow ??
        quote.fiftyTwoWeekHigh ??
        quote.fiftyTwoWeekLow ??
        quote.regularMarketOpen ??
        quote.regularMarketPrice1 ?? // fallback defensivo se a API mudar nome
        null;
      const lastPrice = Number(lastPriceRaw);
      const changePercentRaw =
        quote.regularMarketChangePercent ??
        quote.regularMarketChange ??
        (Number.isFinite(lastPrice) && Number.isFinite(Number(quote.regularMarketPreviousClose ?? null))
          ? ((lastPrice - Number(quote.regularMarketPreviousClose)) / Number(quote.regularMarketPreviousClose)) * 100
          : null);

      if (!Number.isFinite(lastPrice) || lastPrice <= 0) {
        console.warn("[brapi] ignorando preco invalido", { symbol, lastPrice: lastPriceRaw });
        shouldTryYahooFallback = true;
        throw new Error("brapi preco invalido");
      }

      results.push({
        // sempre gravar com o símbolo solicitado para manter compatibilidade com DB (.SA)
        symbol,
        regularMarketPrice: lastPrice,
        regularMarketChange: quote.regularMarketChange ?? null,
        regularMarketChangePercent: Number.isFinite(changePercentRaw) ? changePercentRaw : null,
        currency: quote.currency ?? "BRL",
        regularMarketTime: Number.isFinite(Number(quote.regularMarketTime))
          ? Number(quote.regularMarketTime)
          : Math.floor(Date.now() / 1000),
        source: "brapi.dev",
      });
    } catch (error) {
      console.warn(`[brapi] erro ao buscar ${symbol}:`, error?.message || error);
      if (!shouldTryYahooFallback) {
        continue;
      }
      try {
        const cryptoQuote = await fetchCryptoFallback(symbol);
        console.log("[crypto-fallback] resposta", {
          symbol: cryptoQuote.symbol,
          sourceSymbol: cryptoQuote.sourceSymbol,
          price: cryptoQuote.regularMarketPrice,
          changePercent: cryptoQuote.regularMarketChangePercent,
          currency: cryptoQuote.currency,
        });
        results.push(cryptoQuote);
        continue;
      } catch (cryptoError) {
        console.warn(`[crypto-fallback] erro ao buscar ${symbol}:`, cryptoError?.message || cryptoError);
      }
      try {
        const fallbackQuote = await fetchYahooFallback(symbol);
        console.log("[yahoo-fallback] resposta", {
          symbol: fallbackQuote.symbol,
          sourceSymbol: fallbackQuote.sourceSymbol,
          price: fallbackQuote.regularMarketPrice,
          changePercent: fallbackQuote.regularMarketChangePercent,
          currency: fallbackQuote.currency,
        });
        results.push(fallbackQuote);
      } catch (fallbackError) {
        console.warn(`[yahoo-fallback] erro ao buscar ${symbol}:`, fallbackError?.message || fallbackError);
        if (unauthorizedByBrapi) {
          unauthorizedSymbols.add(symbol);
        }
      }
    }
  }

  return { quotes: results, unauthorizedSymbols: Array.from(unauthorizedSymbols) };
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

async function updateQuotes(targetSymbols = []) {
  if (!supabase) {
    throw new Error("Supabase não configurado (SUPABASE_URL/SUPABASE_SERVICE_KEY).");
  }

  let symbols = targetSymbols.filter(Boolean);

  if (!symbols.length) {
    const { data: assets, error: assetsError } = await supabase.from("ativos").select("symbol").not("symbol", "is", null);
    if (assetsError) {
      throw new Error(`Não foi possível recuperar símbolos cadastrados: ${assetsError.message}`);
    }

    symbols = (assets ?? []).map((item) => item.symbol).filter(Boolean);
  }

  if (!symbols.length) {
    return { updated: 0, history: 0, batches: 0, symbols: [] };
  }

  console.log("[update-quotes] iniciando", { count: symbols.length });
  const batches = chunk(symbols, BATCH_SIZE);
  const now = new Date();
  const historyDate = toISODate(now);
  let updatedCount = 0;
  let historyCount = 0;
  const fetchedSymbols = [];
  const unauthorizedSymbols = new Set();

  for (const group of batches) {
    const { quotes, unauthorizedSymbols: groupUnauthorizedSymbols } = await fetchQuotes(group);
    groupUnauthorizedSymbols.forEach((symbol) => unauthorizedSymbols.add(symbol));

    if (!quotes.length) {
      continue;
    }

    const updates = [];
    const historyRows = [];

    for (const quote of quotes) {
      const symbol = quote.symbol;
      if (!symbol) continue;

      const lastPrice = Number(quote.regularMarketPrice ?? quote.bid ?? quote.ask ?? 0);
      if (!Number.isFinite(lastPrice) || lastPrice <= 0) {
        continue;
      }

      const changePercent = Number(quote.regularMarketChangePercent ?? quote.regularMarketChange ?? 0);
      const currency = quote.currency || "BRL";
      const safeTimeSeconds = Number.isFinite(quote.regularMarketTime)
        ? quote.regularMarketTime
        : Math.floor(now.getTime() / 1000);
      const lastUpdate = new Date(safeTimeSeconds * 1000).toISOString();

      updates.push({
        symbol,
        ultimo_preco: lastPrice,
        variacao_percentual: Number.isFinite(changePercent) ? changePercent : null,
        moeda: currency,
        atualizado_em: lastUpdate,
        fonte: quote.source || "brapi.dev",
      });

      historyRows.push({
        ativo_symbol: symbol,
        preco: lastPrice,
        variacao_percentual: Number.isFinite(changePercent) ? changePercent : null,
        moeda: currency,
        data_registro: historyDate,
      });

      console.log("[update-quotes] preparado", { symbol, lastPrice, changePercent, currency, lastUpdate });
      fetchedSymbols.push(symbol);
    }

    if (updates.length) {
      const { error: updateError } = await supabase.from("ativos").upsert(updates, { onConflict: "symbol" });
      if (updateError) {
        throw new Error(`Erro ao atualizar preços: ${updateError.message}`);
      }
      console.log("[update-quotes] upsert ativos", { count: updates.length });
      updatedCount += updates.length;
    }

    if (historyRows.length) {
      const { error: historyError } = await supabase
        .from("historico_precos")
        .upsert(historyRows, { onConflict: "ativo_symbol,data_registro" });
      if (historyError) {
        throw new Error(`Erro ao registrar histórico: ${historyError.message}`);
      }
      console.log("[update-quotes] upsert historico", { count: historyRows.length });
      historyCount += historyRows.length;
    }
  }

  return {
    updated: updatedCount,
    history: historyCount,
    batches: batches.length,
    symbols: fetchedSymbols,
    unauthorizedSymbols: Array.from(unauthorizedSymbols),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Método não suportado." });
  }

  try {
    let targetSymbols = [];

    if (req.method === "GET") {
      const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
      const symbolsParam = url.searchParams.get("symbols");
      if (symbolsParam) {
        targetSymbols = symbolsParam
          .split(",")
          .map((symbol) => symbol.trim().toUpperCase())
          .filter(Boolean);
      }
    } else if (req.method === "POST") {
      const body = parseBody(req);
      if (Array.isArray(body.symbols)) {
        targetSymbols = body.symbols.map((symbol) => String(symbol).trim().toUpperCase()).filter(Boolean);
      } else if (typeof body.symbols === "string") {
        targetSymbols = body.symbols
          .split(",")
          .map((symbol) => symbol.trim().toUpperCase())
          .filter(Boolean);
      }
    }

    const result = await updateQuotes(targetSymbols);
    return res.status(200).json({
      ok: true,
      ...result,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[update-quotes] erro:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Não foi possível atualizar as cotações.",
    });
  }
}
