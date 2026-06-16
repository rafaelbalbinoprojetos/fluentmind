import React from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const MENU_ITEMS = [
  {
    id: "profile",
    label: "Meu Perfil",
    icon: UserIcon,
    description: "Preferências de estudo",
    action: (navigate, helpers) => {
      navigate("/configuracoes?tab=perfil");
      helpers.close();
    },
  },
  {
    id: "users",
    label: "Usuarios",
    icon: ShieldIcon,
    description: "Acessos e assinaturas",
    action: (navigate, helpers) => {
      navigate("/usuarios");
      helpers.close();
    },
  },
  {
    id: "plans",
    label: "Planos e upgrade",
    icon: SparkIcon,
    description: "IA, audio e revisao",
    action: (_navigate, helpers) => {
      helpers.openPlans?.();
      helpers.close();
    },
  },
  {
    id: "notifications",
    label: "Notificações",
    icon: BellIcon,
    description: "Lembretes de estudo",
    action: (_navigate, helpers) => {
      helpers.openNotifications?.();
      helpers.close();
    },
  },
  {
    id: "security",
    label: "Segurança",
    icon: ShieldIcon,
    description: "Ajustes de autenticação",
    action: (navigate, helpers) => {
      navigate("/configuracoes?tab=seguranca");
      helpers.close();
    },
  },
];

export default function SettingsMenu({ onSignOut, onReload, onOpenNotifications, onOpenPlans }) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef(null);
  const navigate = useNavigate();
  const { themes, theme, selectTheme } = useTheme();
  const { subscription } = useAuth();
  const isMasterUser = Boolean(subscription?.isMasterUser);

  const lightThemes = React.useMemo(() => themes.filter((preset) => preset.mode === "light"), [themes]);
  const darkThemes = React.useMemo(() => themes.filter((preset) => preset.mode === "dark"), [themes]);
  const visibleMenuItems = React.useMemo(
    () => MENU_ITEMS.filter((item) => item.id !== "users" || isMasterUser),
    [isMasterUser],
  );

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEsc = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  const helpers = React.useMemo(
    () => ({
      close: () => setOpen(false),
      openNotifications: onOpenNotifications,
      openPlans: onOpenPlans,
    }),
    [onOpenNotifications, onOpenPlans],
  );

  const handleSelectTheme = (themeId) => {
    selectTheme(themeId);
    setOpen(false);
  };

  const handleReload = () => {
    setOpen(false);
    onReload?.();
  };

  const handleSignOut = () => {
    setOpen(false);
    onSignOut?.();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="settings-menu"
        className={`fm-card flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm backdrop-blur transition hover:brightness-110 ${open ? "ring-2 ring-temaSky/30" : ""}`}
        title="Abrir configurações do usuário"
      >
        <span className="sr-only">{open ? "Fechar configurações" : "Abrir configurações"}</span>
        <GearIcon className="h-5 w-5" />
      </button>

      {open && (
        <div
          id="settings-menu"
          role="dialog"
          aria-modal="false"
          aria-label="Configurações"
          className="fm-popover absolute right-0 top-12 z-40 flex w-80 max-h-[80vh] flex-col rounded-3xl border p-4 text-sm shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <header className="fm-border border-b pb-3">
            <p className="text-sm font-semibold">Configurações</p>
          </header>

          <div className="mt-3 flex-1 overflow-y-auto pr-1">
            <ul className="space-y-2">
              {visibleMenuItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => item.action(navigate, helpers)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2 text-left text-sm transition hover:bg-temaSky/10 hover:text-temaSky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-temaSky/30"
                  >
                    <item.icon className="fm-subtle h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="font-medium">{item.label}</span>
                      <span className="fm-subtle text-xs">{item.description}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <section className="mt-4">
              <div className="flex items-center justify-between">
                <span className="fm-subtle text-xs font-semibold uppercase tracking-wide">
                  Temas claros
                </span>
                <PaletteIcon className="fm-subtle h-4 w-4" />
              </div>
              <ThemeGrid
                themes={lightThemes}
                activeId={theme?.id}
                onSelect={handleSelectTheme}
              />
            </section>

            <section className="mt-4">
              <span className="fm-subtle text-xs font-semibold uppercase tracking-wide">
                Temas escuros
              </span>
              <ThemeGrid
                themes={darkThemes}
                activeId={theme?.id}
                onSelect={handleSelectTheme}
              />
            </section>
          </div>

          <footer className="fm-border mt-4 space-y-2 border-t pt-3 text-xs">
            <button
              type="button"
              onClick={handleReload}
              className="fm-secondary flex w-full items-center gap-2 rounded-2xl px-3 py-2 font-semibold transition hover:bg-temaSky/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-temaSky/30"
            >
              <RefreshIcon className="h-4 w-4" />
              Atualizar
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 font-semibold text-rose-500 transition hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 dark:text-rose-400 dark:hover:bg-rose-400/10"
            >
              <SignOutIcon className="h-4 w-4" />
              Sair
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}

function ThemeGrid({ themes, activeId, onSelect }) {
  if (!themes.length) {
    return (
      <p className="mt-2 rounded-2xl bg-white/[0.06] px-3 py-2 text-xs text-slate-500">
        Nenhum tema disponível.
      </p>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {themes.map((preset) => {
        const isActive = preset.id === activeId;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset.id)}
            title={preset.description}
            className={`group relative flex flex-col gap-2 rounded-2xl border px-2 pb-2 pt-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-temaSky/30 ${
              isActive
                ? "border-temaSky/50 bg-temaSky/10 ring-1 ring-temaSky/30"
                : "fm-border hover:border-temaSky/30 hover:bg-temaSky/10"
            }`}
          >
            <span className="flex h-6 w-full overflow-hidden rounded-md shadow-inner">
              {preset.preview.map((color, index) => (
                <span
                  key={`${preset.id}-color-${index}`}
                  className="flex-1"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
            <span className="fm-muted text-[11px] font-medium transition group-hover:text-temaSky">
              {preset.name}
            </span>
            {isActive && (
              <CheckIcon className="absolute right-1 top-1 h-4 w-4 text-temaSky" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function GearIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M11.303 1.518a1.75 1.75 0 011.394 0l1.41.582a1.75 1.75 0 012.09-.454l1.3.6a1.75 1.75 0 01.93 2.12l-.42 1.41a1.74 1.74 0 010 .894l.42 1.41a1.75 1.75 0 01-.93 2.12l-1.3.6a1.75 1.75 0 01-2.09-.455l-1.41.582a1.75 1.75 0 01-1.394 0l-1.41-.582a1.75 1.75 0 01-2.09.455l-1.3-.6a1.75 1.75 0 01-.93-2.12l.42-1.41a1.74 1.74 0 010-.894l-.42-1.41a1.75 1.75 0 01.93-2.12l1.3-.6a1.75 1.75 0 012.09.455l1.41-.582zM12 9.25a2.25 2.25 0 102.25 2.25A2.25 2.25 0 0012 9.25zm-6.5 4.5a.75.75 0 01.75.75v1.14a2.25 2.25 0 001.11 1.94l.99.57a2.25 2.25 0 001.98.05l1.25-.52.62 1.48a1.75 1.75 0 01-.83 2.18l-1.1.57a1.75 1.75 0 01-2.09-.45l-1.41.58a1.75 1.75 0 01-1.39 0l-1.41-.58a1.75 1.75 0 01-2.09.45l-1.1-.57a1.75 1.75 0 01-.83-2.18l.62-1.48-1.25-.52a2.25 2.25 0 01-1.98-.05l-.99-.57a2.25 2.25 0 01-1.11-1.94v-1.14a.75.75 0 01.75-.75h1.14a2.25 2.25 0 001.94-1.11l.57-.99a2.25 2.25 0 01.05-1.98l.52-1.25 1.48.62a1.75 1.75 0 002.18-.83l.57-1.1a1.75 1.75 0 012.18-.83l1.48.62-.52 1.25a2.25 2.25 0 01.05 1.98l-.57.99a2.25 2.25 0 001.94 1.11h1.14z" />
    </svg>
  );
}

function UserIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2a5 5 0 015 5v1a5 5 0 11-10 0V7a5 5 0 015-5zm-7 17a5 5 0 015-5h4a5 5 0 015 5v1.25A1.75 1.75 0 0117.25 22h-10.5A1.75 1.75 0 015 20.25z" />
    </svg>
  );
}

function SparkIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M11.52 1.7a.75.75 0 011.44 0l1.05 3.23a2.25 2.25 0 001.43 1.44l3.23 1.05a.75.75 0 010 1.44l-3.23 1.05a2.25 2.25 0 00-1.44 1.43l-1.05 3.23a.75.75 0 01-1.44 0L10.47 11a2.25 2.25 0 00-1.43-1.43L5.81 8.06a.75.75 0 010-1.44l3.23-1.05a2.25 2.25 0 001.43-1.44z" />
      <path d="M6 16.5a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 016 16.5zm9.75-.75a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5zM12 13a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0112 13zm0 7a.75.75 0 01.75.75V22a.75.75 0 01-1.5 0v-1.25A.75.75 0 0112 20z" />
    </svg>
  );
}

function BellIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2a6 6 0 00-6 6v2.586c0 .414-.168.81-.469 1.098l-.97.97A1.5 1.5 0 006 15h12a1.5 1.5 0 001.06-2.56l-.97-.97A1.5 1.5 0 0018 10.586V8a6 6 0 00-6-6z" />
      <path d="M10.25 18.75a1.75 1.75 0 003.5 0z" />
    </svg>
  );
}

function ShieldIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2a.75.75 0 01.374.1l7 4a.75.75 0 01.376.65v5.32c0 3.176-2.05 6.125-5.536 7.96a3.9 3.9 0 01-3.628 0C7.1 18.195 5.05 15.246 5.05 12.07V6.75a.75.75 0 01.376-.65l7-4A.75.75 0 0112 2zm0 4.5a.75.75 0 00-.75.75v4.738l-1.72-1.72a.75.75 0 10-1.06 1.06l2.993 2.993a.75.75 0 001.28-.53V7.25A.75.75 0 0012 6.5z" />
    </svg>
  );
}

function PaletteIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2a10 10 0 00-7.07 17.07 1.75 1.75 0 001.59.48l1.73-.4a2.25 2.25 0 011.77.37l2.16 1.62a1.75 1.75 0 002.76-1.4v-.78a2.25 2.25 0 012.25-2.25h1.94a1.75 1.75 0 001.71-2.23A10 10 0 0012 2zm-4.5 6a1.25 1.25 0 111.25-1.25A1.25 1.25 0 017.5 8zm3 3A1.25 1.25 0 1111.75 9.75 1.25 1.25 0 0110.5 11zm3-5.5A1.25 1.25 0 1114.75 4.25 1.25 1.25 0 0113.5 5.5zm2.75 5.5A1.25 1.25 0 1117.5 9.75 1.25 1.25 0 0116.25 11z" />
    </svg>
  );
}

function RefreshIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 4.75A.75.75 0 014.75 4h4.5a.75.75 0 010 1.5H6.81l.22.22a8 8 0 0111.32 0l.11.11a.75.75 0 01-1.06 1.06l-.11-.11a6.5 6.5 0 00-9.19 0L7.5 7.75h1.75a.75.75 0 010 1.5h-4.5A.75.75 0 014 8.5zM19.25 20a.75.75 0 01-.75-.75v-4.5a.75.75 0 011.5 0v1.44l.22-.22a8 8 0 00-11.32-11.32l-.11.11a.75.75 0 01-1.06-1.06l.11-.11a9.5 9.5 0 0113.45 13.45l-.22.22h1.44a.75.75 0 010 1.5z" />
    </svg>
  );
}

function SignOutIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M5.75 4A2.75 2.75 0 003 6.75v10.5A2.75 2.75 0 005.75 20h5.5a.75.75 0 000-1.5h-5.5A1.25 1.25 0 014.5 17.25V6.75A1.25 1.25 0 015.75 5.5h5.5a.75.75 0 000-1.5z" />
      <path d="M15.72 7.22a.75.75 0 10-1.06 1.06L16.94 10.5H10a.75.75 0 000 1.5h6.94l-2.28 2.22a.75.75 0 001.06 1.06l3.75-3.75a.75.75 0 000-1.06z" />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M9.53 16.28a.75.75 0 01-1.06 0l-3.25-3.25a.75.75 0 011.06-1.06l2.72 2.72 6.69-6.69a.75.75 0 111.06 1.06z" />
    </svg>
  );
}
