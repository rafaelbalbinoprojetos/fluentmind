const DEFAULT_MASTER_EMAILS = "balbino10@hotmail.com";

function normalizeEmail(value) {
  if (!value) return "";
  return String(value).trim().toLowerCase();
}

const rawMasterEmails = (() => {
  const envValue = import.meta.env?.VITE_ULTRA_MASTER_EMAILS;
  if (typeof envValue === "string" && envValue.trim().length > 0) {
    return envValue;
  }
  return DEFAULT_MASTER_EMAILS;
})();

export const MASTER_EMAILS = rawMasterEmails
  .split(",")
  .map(normalizeEmail)
  .filter((email, index, list) => email && list.indexOf(email) === index);

export function isMasterEmail(email) {
  return MASTER_EMAILS.includes(normalizeEmail(email));
}

export function sanitizeEmailInput(email) {
  return normalizeEmail(email);
}

export const ULTRA_ACCESS_TABLE = "ultra_access_grants";
