/* eslint-env node */

function normalizeEmail(value) {
  if (!value) return "";
  return String(value).trim().toLowerCase();
}

const DEFAULT_MASTER_EMAILS = "balbino10@hotmail.com";

const MASTER_EMAILS = String(process.env.ULTRA_MASTER_EMAILS || DEFAULT_MASTER_EMAILS)
  .split(",")
  .map(normalizeEmail)
  .filter((email, index, list) => email && list.indexOf(email) === index);

export function isMasterEmail(email) {
  return MASTER_EMAILS.includes(normalizeEmail(email));
}

export function sanitizeEmailInput(email) {
  return normalizeEmail(email);
}
