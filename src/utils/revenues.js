export function parseRevenueDescription(description) {
  if (!description) {
    return { origin: null, notes: null };
  }

  const normalized = description
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (normalized.length === 0) {
    return { origin: null, notes: null };
  }

  const firstLine = normalized[0];
  const originMatch = /^Origem:\s*(.+)$/i.exec(firstLine);

  if (originMatch) {
    const origin = originMatch[1].trim() || null;
    const notes = normalized.slice(1).join(" ").trim() || null;
    return { origin, notes };
  }

  return {
    origin: null,
    notes: normalized.join(" "),
  };
}

export function composeRevenueDescription({ origin, notes }) {
  const parts = [];
  const trimmedOrigin = origin?.trim();
  const trimmedNotes = notes?.trim();

  if (trimmedOrigin) {
    parts.push(`Origem: ${trimmedOrigin}`);
  }

  if (trimmedNotes) {
    parts.push(trimmedNotes);
  }

  if (parts.length === 0) {
    return null;
  }

  return parts.join("\n");
}
