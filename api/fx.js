/* eslint-env node */
const FX_BASE_URL = (process.env.FX_BASE_URL || "https://api.frankfurter.dev/v1").trim();
const FX_ACCESS_KEY = (process.env.FX_ACCESS_KEY || "").trim();

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

  return {
    base,
    symbol,
    rate,
    time,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não suportado." });
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    const symbolsParam = url.searchParams.get("symbols");
    const symbols = symbolsParam
      ? symbolsParam.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean)
      : ["USDBRL", "EURBRL"];

    const results = await Promise.all(
      symbols.map((symbol) => {
        if (symbol === "USDBRL") {
          return fetchFxRate("USD", "BRL")
            .then((data) => ({ ok: true, data, target: symbol }))
            .catch((error) => ({ ok: false, error, target: symbol }));
        }
        if (symbol === "EURBRL") {
          return fetchFxRate("EUR", "BRL")
            .then((data) => ({ ok: true, data, target: symbol }))
            .catch((error) => ({ ok: false, error, target: symbol }));
        }
        const [base, quote] = symbol.split("/");
        if (base && quote) {
          return fetchFxRate(base, quote)
            .then((data) => ({ ok: true, data, target: symbol }))
            .catch((error) => ({ ok: false, error, target: symbol }));
        }
        return Promise.resolve({
          ok: false,
          error: new Error(`Simbolo nao suportado: ${symbol}`),
          target: symbol,
        });
      }),
    );

    const rates = {};
    const errors = [];
    let updatedAt = null;

    results.forEach((result) => {
      if (!result.ok) {
        errors.push({
          symbol: result.target,
          error: result.error?.message || String(result.error),
        });
        return;
      }
      const key = result.target;
      rates[key] = result.data.rate;
      if (!updatedAt || result.data.time > updatedAt) {
        updatedAt = result.data.time;
      }
    });

    return res.status(200).json({
      ok: errors.length === 0,
      rates,
      errors,
      updatedAt: updatedAt ? new Date(updatedAt * 1000).toISOString() : null,
      source: "frankfurter.dev",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Nao foi possivel consultar as cotacoes.",
    });
  }
}
