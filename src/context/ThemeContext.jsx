import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext.jsx";

const STORAGE_KEY = "fluentmind:theme:v2";
const DEFAULT_LIGHT_THEME = "lilac";
const DEFAULT_DARK_THEME = "fluentmind-night";

const ThemeContext = createContext({
  theme: null,
  themeId: DEFAULT_LIGHT_THEME,
  isDark: false,
  themes: [],
  selectTheme: () => {},
  toggleTheme: () => {},
});

function hexToRgbTuple(hex) {
  const sanitized = hex.replace("#", "");
  const bigint = parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r} ${g} ${b}`;
}

function createThemePreset({ id, name, description, mode, preview, colors }) {
  const commonVariables = {
    "--color-accent-primary": hexToRgbTuple(colors.accent),
    "--color-accent-light": hexToRgbTuple(colors.accentLight ?? colors.accent),
    "--color-accent-dark": hexToRgbTuple(colors.accentDark ?? colors.accent),
    "--color-secondary-primary": hexToRgbTuple(colors.secondary ?? colors.accent),
    "--color-secondary-light": hexToRgbTuple(
      colors.secondaryLight ?? colors.secondary ?? colors.accent,
    ),
    "--color-secondary-dark": hexToRgbTuple(
      colors.secondaryDark ?? colors.secondary ?? colors.accent,
    ),
    "--color-tertiary-primary": hexToRgbTuple(colors.tertiary ?? colors.accent),
    "--color-tertiary-light": hexToRgbTuple(
      colors.tertiaryLight ?? colors.tertiary ?? colors.accent,
    ),
    "--color-tertiary-dark": hexToRgbTuple(
      colors.tertiaryDark ?? colors.tertiary ?? colors.accent,
    ),
    "--surface-base": colors.surfaceBase,
    "--surface-card": colors.surfaceCard,
    "--surface-muted": colors.surfaceMuted,
    "--border-soft": colors.borderSoft,
    "--border-strong": colors.borderStrong,
    "--text-primary": colors.textPrimary,
    "--text-secondary": colors.textSecondary,
    "--text-subtle": colors.textSubtle,
    "--shadow-sm": colors.shadowSm ?? "0 1px 2px rgba(15, 23, 42, 0.08)",
    "--shadow-md": colors.shadowMd ?? "0 10px 25px -10px rgba(15, 23, 42, 0.3)",
    "--shadow-lg": colors.shadowLg ?? "0 25px 50px -12px rgba(15, 23, 42, 0.35)",
    "--ring-glow": colors.ringGlow ?? "0 0 #0000",
    "--surface-gradient": colors.surfaceGradient ?? "none",
  };

  return {
    id,
    name,
    description,
    mode,
    preview,
    variables: commonVariables,
  };
}

const THEME_PRESETS = [
  createThemePreset({
    id: "fluentmind-night",
    name: "FluentMind Night",
    description: "Dark premium com roxo, indigo, ciano e acentos de aprendizado.",
    mode: "dark",
    preview: ["#050816", "#111827", "#7c3aed", "#22d3ee", "#fb923c"],
    colors: {
      accent: "#8b5cf6",
      accentLight: "#c4b5fd",
      accentDark: "#6d28d9",
      secondary: "#22d3ee",
      secondaryLight: "#67e8f9",
      secondaryDark: "#0891b2",
      tertiary: "#fb923c",
      tertiaryLight: "#fdba74",
      tertiaryDark: "#ea580c",
      surfaceBase: "#050816",
      surfaceCard: "#0f172a",
      surfaceMuted: "#111827",
      borderSoft: "rgba(148, 163, 184, 0.18)",
      borderStrong: "rgba(139, 92, 246, 0.38)",
      textPrimary: "#f8fafc",
      textSecondary: "#94a3b8",
      textSubtle: "#64748b",
      surfaceGradient:
        "radial-gradient(circle at 20% 0%, rgba(124, 58, 237, 0.22), transparent 32%), radial-gradient(circle at 85% 12%, rgba(14, 165, 233, 0.16), transparent 28%), linear-gradient(145deg, #050816, #070b1f)",
      shadowSm: "0 10px 30px -26px rgba(124, 58, 237, 0.55)",
      shadowMd: "0 30px 80px -48px rgba(14, 165, 233, 0.45)",
      shadowLg: "0 50px 110px -58px rgba(124, 58, 237, 0.58)",
      ringGlow: "0 0 0 3px rgba(34, 211, 238, 0.22)",
    },
  }),
  createThemePreset({
    id: "aurora",
    name: "Aurora Boreal",
    description: "Luz nordica com azuis glaciais e verdes vibrantes.",
    mode: "light",
    preview: ["#2563eb", "#38bdf8", "#0ea5e9", "#14b8a6", "#f4f9ff"],
    colors: {
      accent: "#3b82f6",
      accentLight: "#60a5fa",
      accentDark: "#1d4ed8",
      secondary: "#0ea5e9",
      secondaryLight: "#38bdf8",
      secondaryDark: "#0284c7",
      tertiary: "#14b8a6",
      tertiaryLight: "#2dd4bf",
      tertiaryDark: "#0f766e",
      surfaceBase: "#f4f9ff",
      surfaceCard: "#ffffff",
      surfaceMuted: "#e7f0ff",
      borderSoft: "rgba(59, 130, 246, 0.22)",
      borderStrong: "rgba(2, 132, 199, 0.44)",
      textPrimary: "#0f172a",
      textSecondary: "#1e3a8a",
      textSubtle: "#334155",
      surfaceGradient: "linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(14, 165, 233, 0.06))",
      shadowSm: "0 6px 14px -10px rgba(59, 130, 246, 0.35)",
      shadowMd: "0 24px 40px -18px rgba(14, 165, 233, 0.32)",
      shadowLg: "0 40px 70px -28px rgba(37, 99, 235, 0.35)",
      ringGlow: "0 0 0 3px rgba(59, 130, 246, 0.22)",
    },
  }),
  createThemePreset({
    id: "sunrise",
    name: "Sunrise",
    description: "Amanhecer dourado com ocres e coral iluminado.",
    mode: "light",
    preview: ["#ea580c", "#fb923c", "#facc15", "#fb7185", "#fff4e8"],
    colors: {
      accent: "#f97316",
      accentLight: "#fb923c",
      accentDark: "#ea580c",
      secondary: "#facc15",
      secondaryLight: "#fde047",
      secondaryDark: "#eab308",
      tertiary: "#fb7185",
      tertiaryLight: "#fda4af",
      tertiaryDark: "#f43f5e",
      surfaceBase: "#fff4e8",
      surfaceCard: "#fff0e0",
      surfaceMuted: "#ffe7d3",
      borderSoft: "rgba(249, 115, 22, 0.28)",
      borderStrong: "rgba(234, 88, 12, 0.4)",
      textPrimary: "#431407",
      textSecondary: "#b45309",
      textSubtle: "#7c2d12",
      surfaceGradient: "linear-gradient(135deg, rgba(249, 115, 22, 0.08), rgba(250, 204, 21, 0.06))",
      shadowSm: "0 8px 16px -12px rgba(249, 115, 22, 0.4)",
      shadowMd: "0 26px 45px -20px rgba(234, 88, 12, 0.3)",
      shadowLg: "0 48px 80px -30px rgba(234, 179, 8, 0.32)",
      ringGlow: "0 0 0 3px rgba(249, 115, 22, 0.22)",
    },
  }),
  createThemePreset({
    id: "mint",
    name: "Fresh Mint",
    description: "Verdes cristalinos com respingos aquaticos.",
    mode: "light",
    preview: ["#0f766e", "#14b8a6", "#22d3ee", "#34d399", "#f1fcf5"],
    colors: {
      accent: "#0d9488",
      accentLight: "#2dd4bf",
      accentDark: "#0f766e",
      secondary: "#22d3ee",
      secondaryLight: "#67e8f9",
      secondaryDark: "#0891b2",
      tertiary: "#34d399",
      tertiaryLight: "#6ee7b7",
      tertiaryDark: "#047857",
      surfaceBase: "#f1fcf5",
      surfaceCard: "#ffffff",
      surfaceMuted: "#e3f7ef",
      borderSoft: "rgba(13, 148, 136, 0.24)",
      borderStrong: "rgba(15, 118, 110, 0.38)",
      textPrimary: "#064e3b",
      textSecondary: "#0f766e",
      textSubtle: "#0d9488",
      surfaceGradient: "linear-gradient(135deg, rgba(20, 184, 166, 0.07), rgba(45, 212, 191, 0.05))",
      shadowSm: "0 8px 18px -15px rgba(14, 165, 233, 0.35)",
      shadowMd: "0 28px 55px -32px rgba(13, 148, 136, 0.35)",
      shadowLg: "0 48px 95px -38px rgba(34, 211, 238, 0.32)",
      ringGlow: "0 0 0 3px rgba(13, 148, 136, 0.2)",
    },
  }),
  createThemePreset({
    id: "lilac",
    name: "Lilac Bloom",
    description: "Pastel romantico com lavanda e petalas rosadas.",
    mode: "light",
    preview: ["#9333ea", "#a855f7", "#ec4899", "#f472b6", "#faf5ff"],
    colors: {
      accent: "#a855f7",
      accentLight: "#d8b4fe",
      accentDark: "#9333ea",
      secondary: "#ec4899",
      secondaryLight: "#f472b6",
      secondaryDark: "#db2777",
      tertiary: "#f472b6",
      tertiaryLight: "#fbcfe8",
      tertiaryDark: "#db2777",
      surfaceBase: "#faf5ff",
      surfaceCard: "#fff7ff",
      surfaceMuted: "#f5e8ff",
      borderSoft: "rgba(168, 85, 247, 0.26)",
      borderStrong: "rgba(147, 51, 234, 0.42)",
      textPrimary: "#4a044e",
      textSecondary: "#7c2d81",
      textSubtle: "#9d174d",
      surfaceGradient: "linear-gradient(145deg, rgba(168, 85, 247, 0.08), rgba(236, 72, 153, 0.06))",
      shadowSm: "0 8px 18px -16px rgba(168, 85, 247, 0.35)",
      shadowMd: "0 26px 52px -28px rgba(236, 72, 153, 0.32)",
      shadowLg: "0 52px 100px -36px rgba(157, 23, 77, 0.35)",
      ringGlow: "0 0 0 3px rgba(168, 85, 247, 0.22)",
    },
  }),
  createThemePreset({
    id: "copper",
    name: "Copper Field",
    description: "Campo terroso com verdes oliva sofisticados.",
    mode: "light",
    preview: ["#854d0e", "#b45309", "#a3e635", "#65a30d", "#fdf6e3"],
    colors: {
      accent: "#b45309",
      accentLight: "#f59e0b",
      accentDark: "#854d0e",
      secondary: "#65a30d",
      secondaryLight: "#a3e635",
      secondaryDark: "#4d7c0f",
      tertiary: "#f59e0b",
      tertiaryLight: "#fbbf24",
      tertiaryDark: "#d97706",
      surfaceBase: "#fdf6e3",
      surfaceCard: "#fcefd6",
      surfaceMuted: "#fbe9c4",
      borderSoft: "rgba(180, 83, 9, 0.28)",
      borderStrong: "rgba(133, 77, 14, 0.42)",
      textPrimary: "#422006",
      textSecondary: "#713f12",
      textSubtle: "#854d0e",
      surfaceGradient: "linear-gradient(135deg, rgba(234, 179, 8, 0.08), rgba(101, 163, 13, 0.06))",
      shadowSm: "0 10px 18px -16px rgba(180, 83, 9, 0.35)",
      shadowMd: "0 30px 50px -28px rgba(133, 77, 14, 0.32)",
      shadowLg: "0 55px 95px -36px rgba(101, 163, 13, 0.32)",
      ringGlow: "0 0 0 3px rgba(233, 196, 106, 0.24)",
    },
  }),
  createThemePreset({
    id: "midnight",
    name: "Midnight",
    description: "Noite estrelada com azuis eletricos.",
    mode: "dark",
    preview: ["#1d4ed8", "#2563eb", "#38bdf8", "#22d3ee", "#0d1221"],
    colors: {
      accent: "#38bdf8",
      accentLight: "#60a5fa",
      accentDark: "#1e3a8a",
      secondary: "#22d3ee",
      secondaryLight: "#67e8f9",
      secondaryDark: "#0e7490",
      tertiary: "#38bdf8",
      tertiaryLight: "#60a5fa",
      tertiaryDark: "#1d4ed8",
      surfaceBase: "#0d1221",
      surfaceCard: "#10172b",
      surfaceMuted: "#1a2438",
      borderSoft: "rgba(56, 189, 248, 0.22)",
      borderStrong: "rgba(37, 99, 235, 0.38)",
      textPrimary: "#e2e8f0",
      textSecondary: "#cbd5f5",
      textSubtle: "#94a3b8",
      surfaceGradient: "radial-gradient(circle at 30% 10%, rgba(37, 99, 235, 0.18), transparent 60%)",
      shadowSm: "0 10px 30px -25px rgba(56, 189, 248, 0.55)",
      shadowMd: "0 28px 65px -30px rgba(37, 99, 235, 0.45)",
      shadowLg: "0 60px 110px -40px rgba(14, 165, 233, 0.5)",
      ringGlow: "0 0 0 3px rgba(37, 99, 235, 0.32)",
    },
  }),
  createThemePreset({
    id: "forest-night",
    name: "Forest Night",
    description: "Selva noturna com verdes neon e dourado suave.",
    mode: "dark",
    preview: ["#65a30d", "#22c55e", "#a3e635", "#facc15", "#0b1410"],
    colors: {
      accent: "#22c55e",
      accentLight: "#4ade80",
      accentDark: "#15803d",
      secondary: "#a3e635",
      secondaryLight: "#bef264",
      secondaryDark: "#4d7c0f",
      tertiary: "#facc15",
      tertiaryLight: "#fde047",
      tertiaryDark: "#ca8a04",
      surfaceBase: "#0b1410",
      surfaceCard: "#111d17",
      surfaceMuted: "#192922",
      borderSoft: "rgba(34, 197, 94, 0.26)",
      borderStrong: "rgba(34, 197, 94, 0.42)",
      textPrimary: "#ecfdf5",
      textSecondary: "#bbf7d0",
      textSubtle: "#86efac",
      surfaceGradient: "radial-gradient(circle at 20% 15%, rgba(34, 197, 94, 0.16), transparent 55%)",
      shadowSm: "0 12px 32px -28px rgba(34, 197, 94, 0.48)",
      shadowMd: "0 32px 70px -38px rgba(22, 163, 74, 0.45)",
      shadowLg: "0 68px 120px -48px rgba(134, 239, 172, 0.4)",
      ringGlow: "0 0 0 3px rgba(34, 197, 94, 0.3)",
    },
  }),
  createThemePreset({
    id: "velvet",
    name: "Velvet Night",
    description: "Luxo em roxo profundo com brilho magenta.",
    mode: "dark",
    preview: ["#7c3aed", "#c084fc", "#e879f9", "#fb7185", "#16051f"],
    colors: {
      accent: "#c084fc",
      accentLight: "#d8b4fe",
      accentDark: "#7c3aed",
      secondary: "#e879f9",
      secondaryLight: "#f0abfc",
      secondaryDark: "#c026d3",
      tertiary: "#fb7185",
      tertiaryLight: "#fda4af",
      tertiaryDark: "#f43f5e",
      surfaceBase: "#16051f",
      surfaceCard: "#20072c",
      surfaceMuted: "#2c0d3d",
      borderSoft: "rgba(192, 132, 252, 0.28)",
      borderStrong: "rgba(236, 72, 153, 0.42)",
      textPrimary: "#f5f3ff",
      textSecondary: "#f4d8ff",
      textSubtle: "#f0abfc",
      surfaceGradient: "radial-gradient(circle at 25% 20%, rgba(192, 132, 252, 0.18), transparent 60%)",
      shadowSm: "0 14px 32px -25px rgba(236, 72, 153, 0.5)",
      shadowMd: "0 36px 80px -38px rgba(192, 132, 252, 0.45)",
      shadowLg: "0 75px 130px -50px rgba(244, 114, 182, 0.42)",
      ringGlow: "0 0 0 3px rgba(236, 72, 153, 0.3)",
    },
  }),
  createThemePreset({
    id: "carbon",
    name: "Carbon",
    description: "Monocromatico elegante com destaques eletricos.",
    mode: "dark",
    preview: ["#38bdf8", "#94a3b8", "#7dd3fc", "#0ea5e9", "#0a0f19"],
    colors: {
      accent: "#38bdf8",
      accentLight: "#7dd3fc",
      accentDark: "#0ea5e9",
      secondary: "#94a3b8",
      secondaryLight: "#cbd5e1",
      secondaryDark: "#64748b",
      tertiary: "#22d3ee",
      tertiaryLight: "#67e8f9",
      tertiaryDark: "#0891b2",
      surfaceBase: "#0a0f19",
      surfaceCard: "#101726",
      surfaceMuted: "#172130",
      borderSoft: "rgba(148, 163, 184, 0.28)",
      borderStrong: "rgba(148, 163, 184, 0.46)",
      textPrimary: "#f8fafc",
      textSecondary: "#cbd5f5",
      textSubtle: "#94a3b8",
      surfaceGradient: "linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(148, 163, 184, 0.06))",
      shadowSm: "0 14px 34px -28px rgba(15, 23, 42, 0.7)",
      shadowMd: "0 32px 75px -40px rgba(15, 118, 110, 0.35)",
      shadowLg: "0 78px 140px -55px rgba(14, 165, 233, 0.45)",
      ringGlow: "0 0 0 3px rgba(56, 189, 248, 0.28)",
    },
  }),
];

const THEME_MAP = new Map(THEME_PRESETS.map((theme) => [theme.id, theme]));

export function ThemeProvider({ children }) {
  const { user, userPreferences, updateUserPreferences } = useAuth();
  const explicitPreference = useRef(false);
  const hydratedPreference = useRef(false);

  const [themeId, setThemeId] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_LIGHT_THEME;
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && THEME_MAP.has(stored)) {
      explicitPreference.current = true;
      return stored;
    }

    return DEFAULT_DARK_THEME;
  });

  const activeTheme = useMemo(() => {
    return THEME_MAP.get(themeId) ?? THEME_MAP.get(DEFAULT_LIGHT_THEME);
  }, [themeId]);

  useEffect(() => {
    const preferredTheme = userPreferences?.themeId;
    if (!preferredTheme || !THEME_MAP.has(preferredTheme)) return;
    hydratedPreference.current = true;
    explicitPreference.current = true;
    setThemeId(preferredTheme);
  }, [userPreferences?.themeId]);

  useEffect(() => {
    if (!activeTheme) {
      return;
    }

    const root = document.documentElement;
    root.dataset.theme = activeTheme.id;
    root.dataset.colorMode = activeTheme.mode;
    root.classList.toggle("dark", activeTheme.mode === "dark");

    Object.entries(activeTheme.variables).forEach(([variable, value]) => {
      root.style.setProperty(variable, value);
    });

    if (explicitPreference.current) {
      window.localStorage.setItem(STORAGE_KEY, activeTheme.id);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    if (user?.id && explicitPreference.current && !hydratedPreference.current && userPreferences?.themeId !== activeTheme.id) {
      updateUserPreferences?.({ themeId: activeTheme.id }).catch((error) => {
        console.warn("[theme] Falha ao salvar tema no Supabase:", error.message);
      });
    }
    hydratedPreference.current = false;
  }, [activeTheme]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return undefined;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    if (!media) {
      return undefined;
    }

    const handleChange = () => {
      if (explicitPreference.current) {
        return;
      }

      setThemeId(DEFAULT_DARK_THEME);
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const selectTheme = useCallback((id) => {
    if (!THEME_MAP.has(id)) {
      return;
    }
    explicitPreference.current = true;
    setThemeId(id);
  }, []);

  const toggleTheme = useCallback(() => {
    explicitPreference.current = true;
    setThemeId((current) => {
      const currentTheme = THEME_MAP.get(current);
      if (currentTheme?.mode === "dark") {
        return DEFAULT_LIGHT_THEME;
      }
      return DEFAULT_DARK_THEME;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme: activeTheme,
      themeId: activeTheme?.id ?? DEFAULT_LIGHT_THEME,
      isDark: activeTheme?.mode === "dark",
      themes: THEME_PRESETS,
      selectTheme,
      toggleTheme,
    }),
    [activeTheme, selectTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext);
}
