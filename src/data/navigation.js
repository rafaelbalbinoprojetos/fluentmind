export const NAV_LINKS = [
  { id: "dashboard", to: "/dashboard", label: "Dashboard", shortLabel: "Inicio" },
  { id: "library", to: "/biblioteca", label: "Minha Biblioteca", shortLabel: "Biblioteca" },
  { id: "insights", to: "/insights", label: "Revisao", shortLabel: "Revisao" },
  { id: "chatbot", to: "/chatbot", label: "Conversas", shortLabel: "Conversas" },
  { id: "neuralUniverse", to: "/neural-universe", label: "Neural Universe", shortLabel: "Universe" },
  { id: "users", to: "/usuarios", label: "Usuarios", shortLabel: "Usuarios" },
  { id: "landing", to: "/", label: "Descubra", shortLabel: "Descubra" },
  { id: "settings", to: "/configuracoes", label: "Configuracoes", shortLabel: "Config" },
];

export const MOBILE_NAV_ALLOWED_PATHS = [
  "/dashboard",
  "/biblioteca",
  "/insights",
  "/chatbot",
  "/neural-universe",
  "/configuracoes",
];

export const DEFAULT_MOBILE_NAV_PATHS = [
  "/dashboard",
  "/biblioteca",
  "/insights",
  "/chatbot",
  "/configuracoes",
];

export const MOBILE_NAV_LINKS = NAV_LINKS.filter((link) => MOBILE_NAV_ALLOWED_PATHS.includes(link.to));

export function sanitizeMobileNavSelection(selection) {
  if (!Array.isArray(selection)) {
    return [];
  }
  const normalizedSelection = selection.map((path) => (path === "/" ? "/dashboard" : path));
  const allowedSet = new Set(MOBILE_NAV_ALLOWED_PATHS);
  return MOBILE_NAV_ALLOWED_PATHS.filter((path) => allowedSet.has(path) && normalizedSelection.includes(path));
}

export function normalizeMobileNavSelection(selection) {
  const sanitized = sanitizeMobileNavSelection(selection);
  if (sanitized.length > 0) {
    return sanitized;
  }
  return DEFAULT_MOBILE_NAV_PATHS;
}
