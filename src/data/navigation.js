// Navegação agrupada em 4 áreas: Hoje, Conversar, Revisar e Eu.
// Rotas fora do menu (/conversar, /neo, /conversas) continuam acessíveis por atalhos internos.
export const NAV_GROUPS = [
  { id: "today", label: "Hoje" },
  { id: "talk", label: "Conversar" },
  { id: "review", label: "Revisar" },
  { id: "me", label: "Eu" },
];

export const NAV_LINKS = [
  { id: "dashboard", group: "today", to: "/dashboard", label: "Início", shortLabel: "Hoje" },
  { id: "learningJourney", group: "today", to: "/learning-journey", label: "Jornada Guiada", shortLabel: "Jornada" },
  { id: "neoImmersive", group: "talk", to: "/neo", label: "Neo imersivo", shortLabel: "Neo" },
  { id: "chatbot", group: "talk", to: "/chatbot", label: "Tirar dúvidas com Neo", shortLabel: "Dúvidas" },
  { id: "speaking", group: "talk", to: "/speaking", label: "Treino de pronúncia", shortLabel: "Falar" },
  { id: "insights", group: "review", to: "/insights", label: "Revisão", shortLabel: "Revisar" },
  { id: "mistakes", group: "review", to: "/meus-erros", label: "Meus Erros", shortLabel: "Erros" },
  { id: "playlists", group: "review", to: "/playlists", label: "Playlists de áudio", shortLabel: "Playlists" },
  { id: "library", group: "me", to: "/biblioteca", label: "Minha Biblioteca", shortLabel: "Biblioteca" },
  { id: "history", group: "me", to: "/historico", label: "Meu Progresso", shortLabel: "Progresso" },
  { id: "neuralUniverse", group: "me", to: "/neural-universe", label: "Universo Neural", shortLabel: "Universo" },
  { id: "settings", group: "me", to: "/configuracoes", label: "Configurações", shortLabel: "Config" },
  { id: "users", group: "me", to: "/usuarios", label: "Usuários", shortLabel: "Usuários" },
  { id: "simpleConversation", group: null, to: "/conversar", label: "Conversa livre", shortLabel: "Conversa" },
  { id: "conversations", group: null, to: "/conversas", label: "Conversas salvas", shortLabel: "Conversas" },
];

export const MOBILE_NAV_ALLOWED_PATHS = NAV_LINKS.filter((link) => link.group && link.id !== "users").map((link) => link.to);

export const DEFAULT_MOBILE_NAV_PATHS = ["/dashboard", "/neo", "/insights", "/biblioteca", "/historico"];
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
