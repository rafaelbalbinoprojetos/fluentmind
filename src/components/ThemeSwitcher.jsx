import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";

export default function ThemeSwitcher() {
  const { isDark, toggleTheme, theme } = useTheme();

  const label = isDark
    ? "Alternar para o tema claro padrão"
    : "Alternar para o tema escuro padrão";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={label}
      title={`${label} (atual: ${theme?.name ?? "desconhecido"})`}
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm transition hover:border-temaSky hover:text-temaSky dark:border-gray-700 dark:bg-gray-800 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
    >
      <span className="sr-only">{label}</span>
      {isDark ? <Sun size={20} strokeWidth={1.75} aria-hidden="true" /> : <Moon size={20} strokeWidth={1.75} aria-hidden="true" />}
    </button>
  );
}
