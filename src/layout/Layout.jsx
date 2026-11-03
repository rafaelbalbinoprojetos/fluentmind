import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import SettingsMenu from "../components/SettingsMenu.jsx";
import PageTransition from "../components/PageTransition.jsx";
import WelcomeModal from "../components/WelcomeModal.jsx";
import VoiceRecordingModal from "../components/VoiceRecordingModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import toast, { Toaster } from "react-hot-toast";
import {
  AudioLines,
  Bell as BellIcon,
  Compass,
  Download as InstallIcon,
  House,
  Layers,
  Library,
  ListMusic,
  Menu as MenuIcon,
  MessageCircleQuestion,
  MessageSquareText,
  MessagesSquare,
  Mic,
  Orbit,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  Search as SearchIcon,
  Settings,
  SpellCheck,
  TrendingUp,
  Users,
  X as CloseIcon,
} from "lucide-react";
import {
  NAV_GROUPS,
  NAV_LINKS,
  normalizeMobileNavSelection,
} from "../data/navigation.js";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");


const ICON_MAP = {
  dashboard: House,
  learningJourney: Route,
  history: TrendingUp,
  library: Library,
  playlists: ListMusic,
  insights: Layers,
  speaking: Mic,
  simpleConversation: MessageSquareText,
  neoImmersive: AudioLines,
  chatbot: MessageCircleQuestion,
  conversations: MessagesSquare,
  mistakes: SpellCheck,
  neuralUniverse: Orbit,
  settings: Settings,
  users: Users,
  landing: Compass,
};

const NAV_ITEMS = NAV_LINKS.map((link) => ({
  ...link,
  icon: ICON_MAP[link.id] ?? House,
}));

const LEGAL_LINKS = [
  { to: "/politica-de-privacidade", label: "Política de Privacidade" },
  { to: "/termos-de-uso", label: "Termos de Uso" },
];

const NAV_ITEMS_BY_PATH = new Map(NAV_ITEMS.map((item) => [item.to, item]));

const NOTIFICATION_BADGE_STYLES = {
  info: "bg-temaSky/10 text-temaSky dark:bg-temaEmerald/15 dark:text-temaEmerald",
  success: "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
};

const NOTIFICATION_TYPE_LABELS = {
  info: "Atualizacao",
  success: "Aprendizado",
  warning: "Atencao",
};

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const TIME_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
function getNotificationBadgeClasses(type) {
  return NOTIFICATION_BADGE_STYLES[type] ?? NOTIFICATION_BADGE_STYLES.info;
}

function getNotificationTypeLabel(type) {
  return NOTIFICATION_TYPE_LABELS[type] ?? NOTIFICATION_TYPE_LABELS.info;
}

function getMonthRange(referenceDate = new Date()) {
  const utcYear = referenceDate.getUTCFullYear();
  const utcMonth = referenceDate.getUTCMonth();
  return new Date(Date.UTC(utcYear, utcMonth, 1, 0, 0, 0, 0));
}

function toAscii(value) {
  if (!value) return value;
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function capitalize(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches === true;
  const iosStandalone = window.navigator?.standalone === true;
  return mediaStandalone || iosStandalone;
}

function isAndroidChromiumBrowser() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent || "";
  const isAndroid = /android/i.test(userAgent);
  const hasChromiumEngine = /chrome|crios|edg|opr|brave|samsungbrowser/i.test(userAgent);
  const isFirefox = /firefox|fxios/i.test(userAgent);
  return isAndroid && hasChromiumEngine && !isFirefox;
}

function buildPersonalizedNotifications({ userId, now }) {
  const currentStart = getMonthRange(now);
  const monthKey = `${currentStart.getUTCFullYear()}-${String(currentStart.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthLabel = capitalize(toAscii(MONTH_LABEL_FORMATTER.format(currentStart)));
  const timeLabel = `Atualizado as ${TIME_LABEL_FORMATTER.format(now)}`;
  const summaryIdBase = `${userId ?? "anon"}-${monthKey}`;

  return [
    {
      id: `learning-summary-${summaryIdBase}`,
      title: `Resumo de ${monthLabel}`,
      message: "Continue salvando expressoes, revisando MindBlocks e praticando conversas curtas com IA.",
      time: timeLabel,
      type: "info",
      read: false,
    },
    {
      id: `review-${summaryIdBase}`,
      title: "Revisao inteligente pendente",
      message: "Separe alguns minutos para revisar expressoes recentes e fortalecer sua memoria ativa.",
      time: timeLabel,
      type: "warning",
      read: false,
    },
    {
      id: `conversation-${summaryIdBase}`,
      title: "Pratica recomendada",
      message: "Comece uma conversa curta com IA e salve tres expressoes naturais ao final.",
      time: timeLabel,
      type: "success",
      read: false,
    },
  ];
}
const SIDEBAR_COLLAPSED_KEY = "fluentmind_sidebar_collapsed";

function readSidebarCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

export default function Layout() {
  const [menuAberto, setMenuAberto] = useState(false);
  // Só no desktop: a sidebar pode virar uma coluna de ícones. Aberta por padrão.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState(null);
  const [notificationsVersion, setNotificationsVersion] = useState(0);
  const [quickSearch, setQuickSearch] = useState("");
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [pwaInstallEvent, setPwaInstallEvent] = useState(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [isStandalonePwa, setIsStandalonePwa] = useState(() => isStandaloneMode());
  const [androidChromium, setAndroidChromium] = useState(() => isAndroidChromiumBrowser());
  const location = useLocation();
  const navigate = useNavigate();
  const isChatbotRoute = location.pathname === "/chatbot";
  const navId = "primary-navigation";
  const { user, session, signOut, updateUserMetadata, updateUserPreferences, userPreferences, subscription, startTrial } = useAuth();
  const userMetadata = React.useMemo(() => user?.user_metadata ?? {}, [user]);
  const accessMetadata = user?.app_metadata ?? {};
  const fallbackPlan = accessMetadata.plan ?? "free";
  const fallbackTrialStatus = accessMetadata.trial_status ?? "eligible";
  const fallbackTrialEndsAt = accessMetadata.trial_expires_at ? new Date(accessMetadata.trial_expires_at) : null;
  const fallbackTrialExpired = Boolean(fallbackTrialEndsAt) && fallbackTrialEndsAt.getTime() <= Date.now();
  const fallbackTrialActive = fallbackTrialStatus === "active" && Boolean(fallbackTrialEndsAt) && !fallbackTrialExpired;
  const fallbackHasPremiumAccess = fallbackPlan === "premium" || fallbackTrialActive;
  const fallbackTrialDaysLeft =
    fallbackTrialActive && fallbackTrialEndsAt
      ? Math.max(0, Math.ceil((fallbackTrialEndsAt.getTime() - Date.now()) / 86400000))
      : 0;
  const {
    plan = fallbackPlan,
    effectivePlan = fallbackPlan,
    trialActive = fallbackTrialActive,
    hasPremiumAccess = fallbackHasPremiumAccess,
    hasLifetimeAccess = false,
    isMasterUser = false,
    trialDaysLeft = fallbackTrialDaysLeft,
  } = subscription ?? {};
  const navItems = React.useMemo(
    () => NAV_ITEMS.filter((item) => item.group && (item.id !== "users" || isMasterUser)),
    [isMasterUser],
  );
  const hasSeenWelcome = userPreferences?.extra?.hasSeenWelcome === true || userMetadata.has_seen_welcome === true;
  const mobileNavPreference = userPreferences?.mobileNavPaths ?? userMetadata.mobile_nav_paths;
  const mobileNavItems = React.useMemo(() => {
    const paths = normalizeMobileNavSelection(mobileNavPreference);
    return paths.map((path) => NAV_ITEMS_BY_PATH.get(path)).filter(Boolean).slice(0, 5);
  }, [mobileNavPreference]);
  const notificationContainerRef = React.useRef(null);
  const refreshNotifications = React.useCallback(() => {
    setNotificationsVersion((version) => version + 1);
  }, []);
  const handleOpenPlans = React.useCallback(() => {
    toast("Planos do FluentMind serao reativados em uma etapa futura.");
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateDisplayMode = () => {
      setIsStandalonePwa(isStandaloneMode());
    };
    const displayModeQuery = window.matchMedia?.("(display-mode: standalone)");
    if (displayModeQuery?.addEventListener) {
      displayModeQuery.addEventListener("change", updateDisplayMode);
    } else if (displayModeQuery?.addListener) {
      displayModeQuery.addListener(updateDisplayMode);
    }

    const handleBeforeInstallPrompt = (event) => {
      if (!isAndroidChromiumBrowser()) {
        return;
      }
      event.preventDefault();
      setPwaInstallEvent(event);
      setCanInstallPwa(true);
      setAndroidChromium(true);
      updateDisplayMode();
    };

    const handleInstalled = () => {
      setPwaInstallEvent(null);
      setCanInstallPwa(false);
      setIsStandalonePwa(true);
      toast.success("App instalado com sucesso.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("focus", updateDisplayMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("focus", updateDisplayMode);
      if (displayModeQuery?.removeEventListener) {
        displayModeQuery.removeEventListener("change", updateDisplayMode);
      } else if (displayModeQuery?.removeListener) {
        displayModeQuery.removeListener(updateDisplayMode);
      }
    };
  }, []);
  useEffect(() => {
    if (!user) {
      setWelcomeOpen(false);
      setWelcomeDismissed(false);
      return;
    }

    if (!hasSeenWelcome && !welcomeDismissed) {
      setWelcomeOpen(true);
    } else if (hasSeenWelcome && welcomeOpen) {
      setWelcomeOpen(false);
    }
  }, [user, hasSeenWelcome, welcomeDismissed, welcomeOpen]);

  const activateTrial = React.useCallback(
    async ({ markSeen = true, activate = true } = {}) => {
      if (!user) return "noop";
      let result = hasPremiumAccess ? "already" : "noop";
      if (activate && !hasPremiumAccess) {
        const trial = await startTrial();
        result = trial.trial_status === "active" ? "activated" : "expired";
      }
      if (markSeen) {
        await updateUserMetadata({ has_seen_welcome: true });
        await updateUserPreferences({ extra: { hasSeenWelcome: true } });
      }
      return result === "noop" && markSeen ? "marked" : result;
    },
    [hasPremiumAccess, startTrial, updateUserMetadata, updateUserPreferences, user],
  );

  const handleWelcomeStart = React.useCallback(async () => {
    try {
      setWelcomeDismissed(true);
      const result = await activateTrial({ markSeen: true, activate: true });
      if (result === "activated") {
        toast.success("Teste Premium liberado por 7 dias. Aproveite!");
      } else if (result === "already") {
        toast.success("Você já tem acesso aos recursos Premium.");
      } else if (result === "expired") {
        toast("Seu período de teste já foi utilizado. Conheça os planos Premium para continuar com os recursos avançados.");
      }
    } catch (error) {
      console.error("Erro ao ativar teste:", error);
      toast.error("Não foi possível ativar o teste agora. Tente novamente.");
    } finally {
      setWelcomeOpen(false);
    }
  }, [activateTrial]);

  const handleWelcomeClose = React.useCallback(async () => {
    setWelcomeDismissed(true);
    if (hasSeenWelcome) {
      setWelcomeOpen(false);
      return;
    }

    try {
      await activateTrial({ markSeen: true, activate: false });
    } catch (error) {
      console.error("Erro ao registrar boas-vindas:", error);
    } finally {
      setWelcomeOpen(false);
    }
  }, [activateTrial, hasSeenWelcome]);

  const handleActivateTrial = React.useCallback(async () => {
    try {
      const result = await activateTrial({ markSeen: true, activate: true });
      if (result === "activated") {
        toast.success("Teste Premium liberado por 7 dias. Aproveite!");
      } else if (result === "already") {
        toast.success("Você já possui acesso Premium ou um teste em andamento.");
      } else if (result === "expired") {
        toast("Seu teste gratuito já foi utilizado. Veja os planos Premium para continuar com os recursos avançados.");
      } else if (result === "marked") {
        toast.success("Boas-vindas registradas. Consulte os planos quando quiser.");
      }
    } catch (error) {
      console.error("Erro ao ativar teste Premium:", error);
      setWelcomeDismissed(false);
      toast.error("Não foi possível ativar o teste agora. Tente novamente mais tarde.");
    }
  }, [activateTrial]);


  const unreadCount = notifications.reduce(
    (count, notification) => (notification.read ? count : count + 1),
    0,
  );

  const handleQuickSearchSubmit = (event) => {
    event.preventDefault();
    const query = quickSearch.trim();
    if (!query) {
      return;
    }

    setQuickSearch("");
    if (notificationsOpen) {
      setNotificationsOpen(false);
    }
    navigate(`/chatbot?prompt=${encodeURIComponent(query)}`);
  };

  const handleOpenVoiceAssistant = React.useCallback(() => {
    setVoiceModalOpen(true);
  }, []);

  const handleVoiceTranscribed = React.useCallback((text) => {
    navigate(`/chatbot?prompt=${encodeURIComponent(text)}`);
  }, [navigate]);
  const handleInstallPwa = React.useCallback(async () => {
    if (!pwaInstallEvent) {
      return;
    }

    try {
      await pwaInstallEvent.prompt();
      const choice = await pwaInstallEvent.userChoice;
      if (choice?.outcome === "accepted") {
        toast.success("Instalação iniciada.");
      }
    } catch (error) {
      console.error("Erro ao abrir prompt de instalação:", error);
      toast.error("Não foi possível abrir o instalador agora.");
    } finally {
      setPwaInstallEvent(null);
      setCanInstallPwa(false);
    }
  }, [pwaInstallEvent]);

  useEffect(() => {
    setMenuAberto(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let ignore = false;

    async function fetchPersonalizedNotifications() {
      if (!user?.id) {
        if (!ignore) {
          setNotifications([]);
          setNotificationsError(null);
          setNotificationsLoading(false);
        }
        return;
      }

      if (!ignore) {
        setNotificationsLoading(true);
        setNotificationsError(null);
      }

      try {
        const personalized = buildPersonalizedNotifications({
          userId: user.id,
          now: new Date(),
        });

        if (!ignore) {
          setNotifications(personalized);
        }
      } catch (error) {
        console.error("Erro ao preparar notificações:", error);
        if (!ignore) setNotificationsError(error);
      } finally {
        if (!ignore) {
          setNotificationsLoading(false);
        }
      }
    }

    fetchPersonalizedNotifications();

    return () => {
      ignore = true;
    };
  }, [user?.id, location.key, notificationsVersion]);

  useEffect(() => {
    if (!notificationsOpen) {
      return undefined;
    }

    setNotifications((prevNotifications) =>
      prevNotifications.map((notification) =>
        notification.read ? notification : { ...notification, read: true },
      ),
    );
  }, [notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (!notificationContainerRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
    } catch {
      // Preferência só de conveniência; sem storage a sidebar apenas não lembra o estado.
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setSidebarCollapsed((current) => !current);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!menuAberto) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuAberto(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuAberto]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  const handleOpenNotifications = () => {
    setNotificationsOpen(true);
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  return (
    <div className="fm-app min-h-screen md:grid md:grid-cols-[18rem,1fr]">
      <Toaster position="top-right" />
      {menuAberto && (
        <button
          type="button"
          onClick={() => setMenuAberto(false)}
          className="fixed inset-0 z-30 bg-gray-900/40 backdrop-blur-sm transition md:hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      )}

      <aside
        id={navId}
        className={`fm-sidebar fixed inset-y-0 left-0 z-40 w-72 transform shrink-0 overflow-y-auto border-r backdrop-blur-xl transition-transform duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0 md:overflow-y-auto ${menuAberto ? "translate-x-0" : "-translate-x-full"} ${sidebarCollapsed ? "md:w-[76px]" : ""}`}
        data-collapsed={sidebarCollapsed || undefined}
        role="navigation"
        aria-label="Menu principal"
      >
        <div className="flex h-full flex-col">
          <div className={`fm-border flex items-center justify-between gap-2 border-b py-5 ${sidebarCollapsed ? "px-5 md:flex-col md:px-3" : "px-5"}`}>
            <Link to="/dashboard" className="group flex items-center gap-3" onClick={() => setMenuAberto(false)}>
              <span className="fm-gradient flex h-12 w-12 items-center justify-center rounded-2xl shadow-[0_18px_50px_-18px_rgba(124,58,237,0.8)]">
                <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7" aria-hidden="true">
                  <path d="M10.5 17.5c-2.5-.6-4.1-2.5-4.1-5 0-3 2.4-5.4 5.4-5.4 1 0 1.9.3 2.7.8A5.7 5.7 0 0125.6 10c0 1.2-.4 2.3-1 3.2a6.2 6.2 0 01-3.1 11.5h-2.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10.2 18.1c1.4-2 3.3-3 5.8-3 2.6 0 4.7 1.1 6.4 3.4M9.3 22.7c2-1.5 4.2-2.2 6.7-2.2 2.6 0 4.8.7 6.7 2.2M15.9 15v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className={`flex flex-col leading-tight ${sidebarCollapsed ? "md:hidden" : ""}`}>
                <span className="text-base font-bold">FluentMind</span>
                <span className="fm-secondary text-[10px] font-semibold uppercase tracking-[0.16em]">MindBlocks Method</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setMenuAberto(false)}
              className="fm-muted rounded-xl p-2 transition hover:bg-white/10 hover:text-current md:hidden"
              aria-label="Fechar menu lateral"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((current) => !current)}
              className="fm-muted hidden rounded-xl p-2 transition hover:bg-white/10 hover:text-current md:inline-flex"
              aria-label={sidebarCollapsed ? "Expandir menu (Ctrl+B)" : "Recolher menu (Ctrl+B)"}
              aria-expanded={!sidebarCollapsed}
              aria-controls={navId}
              title={sidebarCollapsed ? "Expandir menu (Ctrl+B)" : "Recolher menu (Ctrl+B)"}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden="true" /> : <PanelLeftClose className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>

          <nav className={`flex flex-col gap-4 py-5 ${sidebarCollapsed ? "px-4 md:px-2" : "px-4"}`}>
            {NAV_GROUPS.map((group) => (
              <div key={group.id} className="flex flex-col gap-1.5">
                <p className={`fm-subtle px-4 text-[11px] font-semibold uppercase tracking-[0.25em] ${sidebarCollapsed ? "md:sr-only" : ""}`}>{group.label}</p>
            {navItems.filter((item) => item.group === group.id).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                title={sidebarCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${sidebarCollapsed ? "md:justify-center md:px-0" : ""} ${
                    isActive
                      ? "fm-nav-active border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "fm-nav-item"
                  }`
                }
              >
                <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className={sidebarCollapsed ? "md:sr-only" : ""}>{item.label}</span>
              </NavLink>
            ))}
              </div>
            ))}
          </nav>

          <div className={`fm-border fm-muted mt-auto hidden border-t px-5 py-6 text-xs ${sidebarCollapsed ? "" : "md:block"}`}>
            <p className="fm-subtle text-[11px] font-semibold uppercase tracking-[0.3em]">
              Segurança
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="fm-nav-item rounded-xl px-3 py-2 font-medium transition"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <div className="fm-main relative flex min-h-screen flex-col overflow-hidden md:relative">
        <header className="fm-header sticky top-0 z-30 w-full border-b px-4 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMenuAberto(true)}
                aria-controls={navId}
                aria-expanded={menuAberto}
                className="fm-muted rounded-xl p-2 transition hover:bg-white/10 hover:text-current md:hidden"
              >
                <span className="sr-only">Abrir menu lateral</span>
                <MenuIcon className="h-5 w-5" />
              </button>

              <h1 className="hidden text-lg font-semibold tracking-tight md:block">
                FluentMind
              </h1>
            </div>

            <form
              role="search"
              onSubmit={handleQuickSearchSubmit}
              className="fm-input flex min-w-0 flex-1 items-center gap-2 rounded-2xl border px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur transition focus-within:ring-2 focus-within:ring-temaSky/15"
            >
              <SearchIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
              <input
                type="search"
                value={quickSearch}
                onChange={(event) => setQuickSearch(event.target.value)}
                placeholder="Search expressions, playlists..."
                className="w-full bg-transparent text-sm focus:outline-none"
                aria-label="Enviar comando rápido para o assistente"
              />
            </form>

            <div className="ml-auto flex items-center gap-3">
              {!hasPremiumAccess && (
                <button
                  type="button"
                onClick={handleOpenPlans}
                  className="fm-chip hidden items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-temaSky/30 sm:inline-flex"
                >
                  <span aria-hidden="true">AI</span>
                  <span>Premium 7 dias</span>
                </button>
              )}
              {hasPremiumAccess && (
                <span className="fm-chip hidden rounded-full border px-3 py-1 text-[11px] font-semibold sm:inline-flex">
                  {hasLifetimeAccess
                    ? "Acesso Ultra vitalício ativo"
                    : plan === "premium" || (effectivePlan === "premium" && !trialActive)
                      ? "Plano Premium ativo"
                      : trialActive && trialDaysLeft > 1
                        ? `${trialDaysLeft} dias restantes de teste`
                        : trialActive
                          ? "Último dia do teste Premium"
                          : "Acesso premium ativo"}
                </span>
              )}
              {user?.email && (
                <span className="fm-muted hidden text-xs sm:block">
                  {user.email}
                </span>
              )}
              <div className="relative" ref={notificationContainerRef}>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((prev) => !prev)}
                  aria-haspopup="dialog"
                  aria-expanded={notificationsOpen}
                  aria-controls="notification-panel"
                  className={`fm-card relative flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm transition hover:brightness-110 ${notificationsOpen ? "ring-2 ring-temaSky/30" : ""}`}
                >
                  <span className="sr-only">
                    {notificationsOpen ? "Fechar notificações" : "Abrir notificações"}
                  </span>
                  <BellIcon className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div
                    id="notification-panel"
                    role="dialog"
                    aria-modal="false"
                    aria-label="Notificações recentes"
                    className="fm-popover absolute right-0 top-12 z-40 w-80 rounded-3xl border p-4 text-sm shadow-2xl shadow-black/40 backdrop-blur-xl"
                  >
                    <div className="fm-border flex items-center justify-between border-b pb-3">
                      <p className="font-semibold">Notificações</p>
                      {notificationsLoading ? (
                        <span className="text-xs text-gray-400 dark:text-gray-500">Carregando...</span>
                      ) : notificationsError ? (
                        <button
                          type="button"
                          onClick={refreshNotifications}
                          className="text-xs font-semibold text-rose-500 transition hover:text-rose-400 dark:text-rose-400 dark:hover:text-rose-300"
                        >
                          Tentar novamente
                        </button>
                      ) : unreadCount === 0 ? (
                        <span className="text-xs text-gray-400 dark:text-gray-500">Atualizado</span>
                      ) : (
                        <span className="rounded-full bg-temaSky/15 px-2 py-0.5 text-[10px] font-medium text-temaSky dark:bg-temaEmerald/15 dark:text-temaEmerald">
                          {unreadCount} novas
                        </span>
                      )}
                    </div>

                    <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
                      {notificationsLoading ? (
                        <p className="fm-inner fm-muted rounded-2xl px-3 py-4 text-sm">
                          Carregando notificações personalizadas...
                        </p>
                      ) : notificationsError ? (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
                          <p className="font-semibold">Não foi possível carregar as notificações agora.</p>
                          <button
                            type="button"
                            onClick={refreshNotifications}
                            className="mt-2 inline-flex items-center text-[11px] font-semibold text-rose-600 underline-offset-2 hover:underline dark:text-rose-300"
                          >
                            Tentar novamente
                          </button>
                        </div>
                      ) : notifications.length === 0 ? (
                        <p className="fm-inner fm-muted rounded-2xl px-3 py-4 text-sm">
                          Nenhuma notificação no momento.
                        </p>
                      ) : (
                        notifications.map((notification) => (
                          <article
                            key={notification.id}
                            className={`rounded-lg border p-3 transition dark:border-gray-800 ${
                              notification.read
                                ? "fm-card"
                                : "fm-chip"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold">
                                  {notification.title}
                                </p>
                                <p className="fm-muted text-xs">
                                  {notification.message}
                                </p>
                              </div>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getNotificationBadgeClasses(notification.type)}`}
                              >
                                {getNotificationTypeLabel(notification.type)}
                              </span>
                            </div>
                            <p className="mt-3 text-xs font-medium text-gray-400 dark:text-gray-500">
                              {notification.time}
                            </p>
                          </article>
                        ))
                      )}
                    </div>

                    {notifications.length > 0 && !notificationsLoading && !notificationsError && (
                      <div className="fm-border fm-subtle mt-4 flex items-center justify-between border-t pt-3 text-xs">
                        <button
                          type="button"
                          onClick={handleClearNotifications}
                          className="fm-secondary font-semibold transition hover:brightness-125"
                        >
                          Limpar tudo
                        </button>
                        <span>Última atualização há pouco</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <SettingsMenu
                onSignOut={handleSignOut}
                onReload={handleReload}
                onOpenNotifications={handleOpenNotifications}
                onOpenPlans={handleOpenPlans}
              />
            </div>
          </div>
        </header>

        {!hasPremiumAccess && (
          <div className="fm-gradient-soft relative z-10 border-b px-4 py-4 text-sm md:px-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="flex items-start gap-2">
                <span>
                  Premium desbloqueia conversas com IA, transcrição de voz, playlists de frases e revisão inteligente.
                  Experimente grátis por 7 dias.
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleActivateTrial}
                  className="fm-gradient inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-temaSky/30"
                >
                  Ativar teste agora
                </button>
                <button
                  type="button"
                onClick={handleOpenPlans}
                  className="fm-chip inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-temaSky/30"
                >
                  Ver planos
                </button>
              </div>
            </div>
          </div>
        )}

        <main className={`relative z-10 flex-1 px-3 pt-5 sm:px-4 md:p-7 md:pb-8 ${isChatbotRoute ? "pb-0 md:pb-8" : "pb-24"}`}>
          <PageTransition />
        </main>

        <section className="fm-footer relative z-10 hidden border-t px-4 py-5 text-sm md:block md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-base font-semibold">Privacidade e continuidade</p>
              <p className="fm-muted text-xs">
                Consulte nossa Política de Privacidade e os Termos de Uso sempre que precisar revisar seus direitos.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="fm-card inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition hover:brightness-110"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <VoiceRecordingModal
          open={voiceModalOpen}
          onClose={() => setVoiceModalOpen(false)}
          onTranscribed={handleVoiceTranscribed}
          apiBase={API_BASE}
          accessToken={session?.access_token}
        />

        {!isChatbotRoute && (
          <button
            type="button"
            onClick={handleOpenVoiceAssistant}
            className="fm-card fm-secondary fixed bottom-20 right-4 z-40 inline-flex h-12 w-12 flex-none items-center justify-center rounded-2xl border shadow-lg shadow-black/30 backdrop-blur transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-temaSky/30 md:bottom-6 md:right-6"
            aria-label="Iniciar gravação do assistente"
            title="Iniciar gravação no assistente"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.6}
                d="M12 16a3 3 0 003-3V7a3 3 0 00-6 0v6a3 3 0 003 3z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.6}
                d="M19 11a7 7 0 01-14 0M12 19v3"
              />
            </svg>
          </button>
        )}
        {androidChromium && canInstallPwa && !isStandalonePwa && (
          <button
            type="button"
            onClick={handleInstallPwa}
            className="fixed bottom-36 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-500/95 px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 dark:border-emerald-400/40 dark:bg-emerald-500 dark:hover:bg-emerald-400 md:bottom-20 md:right-6"
            aria-label="Instalar aplicativo"
            title="Instalar aplicativo"
          >
            <InstallIcon className="h-4 w-4" />
            <span>Instalar app</span>
          </button>
        )}

        <nav className="fm-header fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t py-2 backdrop-blur-xl md:hidden">
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 text-xs font-medium transition ${
                  isActive
                    ? "fm-secondary"
                    : "fm-subtle hover:brightness-125"
                }`
              }
              aria-label={item.label}
            >
              <item.icon className="h-5 w-5" strokeWidth={1.75} />
              <span>{item.shortLabel}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      <WelcomeModal
        open={welcomeOpen}
        onStart={handleWelcomeStart}
        onClose={handleWelcomeClose}
      />
    </div>
  );
}

