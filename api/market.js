/* eslint-env node */
const FX_BASE_URL = (process.env.FX_BASE_URL || "https://api.frankfurter.dev/v1").trim();
const FX_ACCESS_KEY = (process.env.FX_ACCESS_KEY || "").trim();
const BRAPI_URL = (process.env.BRAPI_URL || "https://brapi.dev/api/quote").trim();
const BRAPI_TOKEN = (process.env.BRAPI_TOKEN || "").trim();

async function fetchFxRate(base, symbol) {
  const params = new URLSearchParams({ base, symbols: symbol });
  if (FX_ACCESS_KEY) params.set("access_key", FX_ACCESS_KEY);
  const url = `${FX_BASE_URL}/latest?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "KORDEN/1.0 (+https://grana.app)",
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Falha ao buscar ${base}->${symbol}: ${response.status} ${details}`);
  }

  const payload = await response.json();
  const rate = Number(payload?.rates?.[symbol]);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Taxa invalida para ${base}->${symbol}`);
  }

  const time =
    Number(payload?.timestamp) ||
    (payload?.date ? Math.floor(new Date(payload.date).getTime() / 1000) : null) ||
    Math.floor(Date.now() / 1000);

  return { rate, time };
}

async function fetchBrapiQuote(symbol) {
  const params = new URLSearchParams({ range: "1d", interval: "1d" });
  if (BRAPI_TOKEN) params.set("token", BRAPI_TOKEN);
  const url = `${BRAPI_URL}/${encodeURIComponent(symbol)}?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "KORDEN/1.0 (+https://grana.app)",
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Falha ao buscar ${symbol}: ${response.status} ${details}`);
  }

  const payload = await response.json();
  const quote = payload?.results?.[0];
  if (!quote) {
    throw new Error(`Resposta invalida para ${symbol}`);
  }

  const price = Number(
    quote.regularMarketPrice ??
      quote.regularMarketPreviousClose ??
      quote.regularMarketDayHigh ??
      quote.regularMarketDayLow ??
      quote.regularMarketOpen ??
      null,
  );

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Preco invalido para ${symbol}`);
  }

  return {
    symbol,
    price,
    currency: quote.currency || null,
    time: Number(quote.regularMarketTime) || Math.floor(Date.now() / 1000),
  };
}

async function fetchFirstBrapi(symbols = []) {
  let lastError = null;
  for (const symbol of symbols) {
    try {
      const data = await fetchBrapiQuote(symbol);
      return data;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  throw new Error("Sem simbolos para BTC.");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não suportado." });
  }

  try {
    const [usd, eur] = await Promise.all([fetchFxRate("USD", "BRL"), fetchFxRate("EUR", "BRL")]);
    let btc = null;
    let btcBrl = null;

    try {
      btc = await fetchFirstBrapi(["BTC-BRL", "BTCBRL", "BTC-USD", "BTCUSD"]);
      if (btc?.currency?.toUpperCase() === "BRL") {
        btcBrl = btc.price;
      } else if (btc?.currency?.toUpperCase() === "USD") {
        btcBrl = btc.price * usd.rate;
      }
    } catch (error) {
      console.warn("[market] falha ao buscar BTC:", error?.message || error);
    }

    const updatedAtUnix = Math.max(usd.time, eur.time, btc?.time || 0);

    return res.status(200).json({
      ok: true,
      rates: {
        USDBRL: usd.rate,
        EURBRL: eur.rate,
        BTCBRL: btcBrl,
      },
      updatedAt: updatedAtUnix ? new Date(updatedAtUnix * 1000).toISOString() : null,
      source: {
        fx: "frankfurter.dev",
        btc: btc ? "brapi.dev" : null,
        btcSymbol: btc?.symbol ?? null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Nao foi possivel consultar as cotacoes.",
    });
  }
}
