const DEFAULT_LOCALE = "pt-BR";

const CURRENCY_CACHE = new Map();

function getCurrencyFormatter(currency = "BRL") {
  const key = `${DEFAULT_LOCALE}-${currency}`;
  if (!CURRENCY_CACHE.has(key)) {
    CURRENCY_CACHE.set(
      key,
      new Intl.NumberFormat(DEFAULT_LOCALE, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
      }),
    );
  }
  return CURRENCY_CACHE.get(key);
}

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  dateStyle: "short",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  dateStyle: "short",
  timeStyle: "short",
});

function normalizeDateInput(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const isoLike = /^\d{4}-\d{2}-\d{2}$/;
    const candidate = isoLike.test(trimmed) ? `${trimmed}T00:00:00Z` : trimmed;
    const parsed = new Date(candidate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

export function formatCurrency(value, options = {}) {
  const { sign = "none", fallback = "—", currency = "BRL" } = options;
  if (value === null || value === undefined) {
    return fallback;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  const formatter = getCurrencyFormatter(currency);
  const formatted = formatter.format(Math.abs(numeric));

  if (sign === "negative") {
    return `${numeric < 0 ? "- " : ""}${formatted}`;
  }

  if (sign === "plusOrMinus") {
    if (numeric > 0) return `+ ${formatted}`;
    if (numeric < 0) return `- ${formatted}`;
    return formatted;
  }

  if (sign === "auto") {
    if (numeric < 0) return `- ${formatted}`;
    if (numeric > 0) return `+ ${formatted}`;
  }

  return formatted;
}

export function formatDate(value, { fallback = "—" } = {}) {
  const parsed = normalizeDateInput(value);
  if (!parsed) return fallback;
  return DATE_FORMATTER.format(parsed);
}

export function formatDateTime(value, { fallback = "—" } = {}) {
  const parsed = normalizeDateInput(value);
  if (!parsed) return fallback;
  return DATE_TIME_FORMATTER.format(parsed);
}

export function toDateInputValue(value) {
  const parsed = normalizeDateInput(value);
  if (!parsed) return "";
  return parsed.toISOString().slice(0, 10);
}

export function toDateTimeLocalValue(value) {
  const parsed = normalizeDateInput(value);
  if (!parsed) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
