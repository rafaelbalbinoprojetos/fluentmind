export function parseDecimalInput(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (typeof rawValue === "number") {
    return Number.isFinite(rawValue) ? rawValue : null;
  }

  let normalized = String(rawValue).trim().replace(/\s+/g, "");

  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(/,/g, ".");
  }

  if (normalized.length === 0) {
    return null;
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric;
}

export function normalizeDateForSupabase(value) {
  if (!value) {
    return null;
  }

  const segments = value.split("-");
  if (segments.length !== 3) {
    return null;
  }

  const [yearStr, monthStr, dayStr] = segments;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (Number.isNaN(utcDate.getTime())) {
    return null;
  }

  return {
    iso: utcDate.toISOString(),
    date: utcDate.toISOString().slice(0, 10),
  };
}

export function ensureFiniteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}
