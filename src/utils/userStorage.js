// Unscoped legacy values have no reliable owner and must never be auto-imported.
export function userStorageKey(key, userId) {
  return `${key}:${userId || "guest"}`;
}
