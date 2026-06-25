export const NAV_LINKS = [
  { id: "dashboard", to: "/dashboard", label: "Início", shortLabel: "Início" },
  { id: "learningJourney", to: "/learning-journey", label: "Jornada Guiada", shortLabel: "Jornada" },
  { id: "history", to: "/historico", label: "Histórico", shortLabel: "Histórico" },
  { id: "library", to: "/biblioteca", label: "Minha Biblioteca", shortLabel: "Biblioteca" },
  { id: "playlists", to: "/playlists", label: "Playlists", shortLabel: "Playlists" },
  { id: "insights", to: "/insights", label: "Revisão", shortLabel: "Revisão" },
  { id: "chatbot", to: "/chatbot", label: "Conversar com Neo", shortLabel: "Neo" },
  { id: "conversations", to: "/conversas", label: "Conversas", shortLabel: "Conversas" },
  { id: "mistakes", to: "/meus-erros", label: "Meus Erros", shortLabel: "Erros" },
  { id: "neuralUniverse", to: "/neural-universe", label: "Universo Neural", shortLabel: "Universo" },
  { id: "users", to: "/usuarios", label: "Usuários", shortLabel: "Usuários" },
  { id: "landing", to: "/", label: "Descubra", shortLabel: "Descubra" },
  { id: "settings", to: "/configuracoes", label: "Configurações", shortLabel: "Config" },
];

export const MOBILE_NAV_ALLOWED_PATHS = [
  "/dashboard",
  "/learning-journey",
  "/historico",
  "/biblioteca",
  "/playlists",
  "/insights",
  "/chatbot",
  "/conversas",
  "/meus-erros",
  "/neural-universe",
  "/configuracoes",
];

export const DEFAULT_MOBILE_NAV_PATHS = [
  "/dashboard",
  "/learning-journey",
  "/historico",
  "/biblioteca",
  "/playlists",
  "/insights",
  "/chatbot",
  "/conversas",
  "/meus-erros",
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
