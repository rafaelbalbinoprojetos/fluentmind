import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell as BellIcon,
  Check as CheckIcon,
  LogOut as SignOutIcon,
  Palette as PaletteIcon,
  RefreshCw as RefreshIcon,
  Settings as GearIcon,
  ShieldCheck as ShieldIcon,
  Sparkles as SparkIcon,
  User as UserIcon,
} from "lucide-react";
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
