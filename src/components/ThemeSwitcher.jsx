import React from "react";
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
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 4.75a.75.75 0 01-.75-.75V2a.75.75 0 011.5 0v2a.75.75 0 01-.75.75zm0 16.5a.75.75 0 01-.75-.75v-2a.75.75 0 111.5 0v2a.75.75 0 01-.75.75zm8-8a.75.75 0 01-.75-.75H17a.75.75 0 010-1.5h2.25a.75.75 0 010 1.5H20a.75.75 0 01-.75.75zm-16 0a.75.75 0 01-.75-.75H3a.75.75 0 010-1.5h2.25a.75.75 0 010 1.5H4a.75.75 0 01-.75.75zm11.48 6.02a.75.75 0 011.06 1.06l-1.6 1.6a.75.75 0 11-1.06-1.06l1.6-1.6zm-8.48-8.48a.75.75 0 011.06 0l1.6 1.6a.75.75 0 01-1.06 1.06l-1.6-1.6a.75.75 0 010-1.06zm0 9.54l1.6-1.6a.75.75 0 111.06 1.06l-1.6 1.6a.75.75 0 11-1.06-1.06zm8.48-8.48a.75.75 0 011.06-1.06l1.6 1.6a.75.75 0 01-1.06 1.06l-1.6-1.6zM12 7a5 5 0 100 10 5 5 0 000-10z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.894 14.043a.75.75 0 00-.917-.918 6.5 6.5 0 01-9.102-6.737.75.75 0 00-.88-.883 8 8 0 108.898 8.898.75.75 0 00.001-.36z" />
    </svg>
  );
}
