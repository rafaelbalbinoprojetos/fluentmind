import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import SettingsMenu from "../components/SettingsMenu.jsx";
import PageTransition from "../components/PageTransition.jsx";
import WelcomeModal from "../components/WelcomeModal.jsx";
import VoiceRecordingModal from "../components/VoiceRecordingModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import toast, { Toaster } from "react-hot-toast";
import {
  NAV_LINKS,
  normalizeMobileNavSelection,
} from "../data/navigation.js";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const ICON_MAP = {
  dashboard: DashboardIcon,
  library: LibraryIcon,
  playlists: LibraryIcon,
  insights: InsightsIcon,
  chatbot: ChatbotIcon,
  conversations: ChatbotIcon,
  mistakes: InsightsIcon,
  neuralUniverse: NeuralUniverseIcon,
  settings: SettingsIcon,
  users: SettingsIcon,
  landing: LibraryIcon,
};

const NAV_ITEMS = NAV_LINKS.map((link) => ({
  ...link,
  icon: ICON_MAP[link.id] ?? DashboardIcon,
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
export default function Layout() {
  const [menuAberto, setMenuAberto] = useState(false);
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
  const { user, session, signOut, updateUserMetadata, subscription } = useAuth();
  const userMetadata = React.useMemo(() => user?.user_metadata ?? {}, [user]);
  const fallbackPlan = userMetadata.plan ?? "free";
  const fallbackTrialStatus = userMetadata.trial_status ?? "eligible";
  const fallbackTrialEndsAt = userMetadata.trial_expires_at ? new Date(userMetadata.trial_expires_at) : null;
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
    trialStatus = fallbackTrialStatus,
    trialExpired = fallbackTrialExpired,
    trialActive = fallbackTrialActive,
    hasPremiumAccess = fallbackHasPremiumAccess,
    hasLifetimeAccess = false,
    isMasterUser = false,
    trialDaysLeft = fallbackTrialDaysLeft,
  } = subscription ?? {};
  const navItems = React.useMemo(
    () => NAV_ITEMS.filter((item) => item.id !== "users" || isMasterUser),
    [isMasterUser],
  );
  const hasSeenWelcome = userMetadata.has_seen_welcome === true;
  const mobileNavPreference = userMetadata.mobile_nav_paths;
  const mobileNavItems = React.useMemo(() => {
    const paths = normalizeMobileNavSelection(mobileNavPreference);
    return paths.map((path) => NAV_ITEMS_BY_PATH.get(path)).filter(Boolean);
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

  useEffect(() => {
    if (!updateUserMetadata) return;
    if (trialStatus === "active" && trialExpired) {
      updateUserMetadata({ trial_status: "expired" }).catch((error) => {
        console.error("Erro ao atualizar status do teste:", error);
      });
    }
  }, [trialExpired, trialStatus, updateUserMetadata]);

  const activateTrial = React.useCallback(
    async ({ markSeen = true, activate = true } = {}) => {
      if (!updateUserMetadata || !user) {
        return "noop";
      }

      const metadata = userMetadata;
      const alreadyPremium = metadata.plan === "premium" || hasLifetimeAccess;
      const expiresAt = metadata.trial_expires_at ? new Date(metadata.trial_expires_at) : null;
      const trialExpiredFlag = Boolean(expiresAt) && expiresAt.getTime() <= Date.now();
      const isActive = metadata.trial_status === "active" && !trialExpiredFlag;
      const alreadyStarted = Boolean(metadata.trial_started_at);
      const trialConsumed = alreadyStarted && trialExpiredFlag && metadata.trial_status === "expired";
      const payload = {};
      let result = "noop";

      if (markSeen && metadata.has_seen_welcome !== true) {
        payload.has_seen_welcome = true;
        result = "marked";
      }

      const isEligibleStatus = !metadata.trial_status || metadata.trial_status === "eligible";
      const canActivate = activate && !alreadyPremium && !alreadyStarted && isEligibleStatus;

      if (canActivate) {
        const now = new Date();
        const expires = new Date(now.getTime() + TRIAL_DURATION_MS);
        payload.trial_status = "active";
        payload.trial_started_at = now.toISOString();
        payload.trial_expires_at = expires.toISOString();
        result = "activated";
      }

      if (Object.keys(payload).length === 0) {
        if (alreadyPremium || isActive) {
          return "already";
        }
        if (trialConsumed) {
          return "expired";
        }
        return result;
      }

      await updateUserMetadata(payload);
      if (result === "activated") {
        return "activated";
      }
      if (alreadyPremium || isActive) {
        return "already";
      }
      if (trialConsumed) {
        return "expired";
      }
      return result;
    },
    [hasLifetimeAccess, updateUserMetadata, user, userMetadata],
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
        className={`fm-sidebar fixed inset-y-0 left-0 z-40 w-72 transform overflow-y-auto border-r backdrop-blur-xl transition-transform duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0 md:overflow-y-auto ${menuAberto ? "translate-x-0" : "-translate-x-full"}`}
        role="navigation"
        aria-label="Menu principal"
      >
        <div className="flex h-full flex-col">
          <div className="fm-border flex items-center justify-between border-b px-5 py-5">
            <Link to="/dashboard" className="group flex items-center gap-3" onClick={() => setMenuAberto(false)}>
              <span className="fm-gradient flex h-12 w-12 items-center justify-center rounded-2xl shadow-[0_18px_50px_-18px_rgba(124,58,237,0.8)]">
                <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7" aria-hidden="true">
                  <path d="M10.5 17.5c-2.5-.6-4.1-2.5-4.1-5 0-3 2.4-5.4 5.4-5.4 1 0 1.9.3 2.7.8A5.7 5.7 0 0125.6 10c0 1.2-.4 2.3-1 3.2a6.2 6.2 0 01-3.1 11.5h-2.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10.2 18.1c1.4-2 3.3-3 5.8-3 2.6 0 4.7 1.1 6.4 3.4M9.3 22.7c2-1.5 4.2-2.2 6.7-2.2 2.6 0 4.8.7 6.7 2.2M15.9 15v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="flex flex-col leading-tight">
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
          </div>

          <nav className="flex flex-col gap-1.5 px-4 py-5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "fm-nav-active border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "fm-nav-item"
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="fm-border fm-muted mt-auto border-t px-5 py-6 text-xs">
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

        <section className={`fm-footer relative z-10 border-t px-4 py-5 text-sm md:px-8 ${isChatbotRoute ? "hidden md:block" : ""}`}>
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
              <item.icon className="h-5 w-5" />
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

function DashboardIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M11 3H5a2 2 0 00-2 2v6h8V3zm2 0v8h8V5a2 2 0 00-2-2h-6zm8 10h-8v6h6a2 2 0 002-2v-4zm-10 6v-6H3v4a2 2 0 002 2h6z" />
    </svg>
  );
}

function ExpensesIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 109 9 .75.75 0 00-1.5 0 7.5 7.5 0 11-2.92-5.94H15a.75.75 0 000-1.5h-1.5V3.75a.75.75 0 00-1.5 0V4.5A3.75 3.75 0 0015 8.25h1.69A7.5 7.5 0 0112 20.5a.75.75 0 000 1.5 9 9 0 000-18z" />
      <path d="M9.75 11.25A.75.75 0 0110.5 10h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75zm0 3a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75z" />
    </svg>
  );
}

function BillsIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 2.25A2.25 2.25 0 003.75 4.5v15A2.25 2.25 0 006 21.75h12A2.25 2.25 0 0020.25 19.5V9.75L14.25 2.25zM13.5 3.94L18.56 9H15a1.5 1.5 0 01-1.5-1.5z" />
      <path d="M8.25 12.75a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5zm0 3.75a.75.75 0 000 1.5h5.25a.75.75 0 000-1.5z" />
    </svg>
  );
}

function IncomeIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2a.75.75 0 01.75.75V4h1.5a3.75 3.75 0 010 7.5h-5a2.25 2.25 0 000 4.5h1.5v-1.25a.75.75 0 111.5 0v1.25h.75a2.25 2.25 0 002.25-2.25.75.75 0 111.5 0 3.75 3.75 0 01-3.75 3.75H12v1.25a.75.75 0 01-1.5 0V18h-1.5a3.75 3.75 0 010-7.5h5a2.25 2.25 0 000-4.5H12a2.25 2.25 0 00-2.25 2.25.75.75 0 01-1.5 0A3.75 3.75 0 0112 2z" />
    </svg>
  );
}

function InvestIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M5.25 3a.75.75 0 000 1.5H6v12.25A2.25 2.25 0 008.25 19h7.5A2.25 2.25 0 0018 16.75V4.5h.75a.75.75 0 000-1.5h-5.5a.75.75 0 000 1.5h.75V8l-2.22-1.48a.75.75 0 00-.84 0L9 8V4.5h.75a.75.75 0 000-1.5h-4.5zM9 9.75l1.72-1.15L12.5 9.75v7h-3.5v-7z" />
      <path d="M8.25 21a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-7.5z" />
    </svg>
  );
}

function CompoundIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 3.75A.75.75 0 013.75 3h16.5a.75.75 0 010 1.5h-15v15a.75.75 0 01-1.5 0V3.75z" />
      <path d="M20.47 6.28a.75.75 0 00-1.06-1.06l-5.66 5.66-3.47-3.47a.75.75 0 00-1.06 0l-4.5 4.5a.75.75 0 001.06 1.06l3.97-3.97 3.47 3.47a.75.75 0 001.06 0l6.19-6.19z" />
    </svg>
  );
}

function ExtraIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 1.5a1 1 0 01.87.5l1.69 2.93 3.36.72a1 1 0 01.54 1.61l-2.34 2.52.4 3.47a1 1 0 01-1.47 1l-3.05-1.6-3.05 1.6a1 1 0 01-1.47-1l.4-3.47-2.34-2.52a1 1 0 01.54-1.61l3.36-.72L11.13 2a1 1 0 01.87-.5z" />
      <path d="M5.75 18a.75.75 0 000 1.5h12.5a.75.75 0 000-1.5H5.75zM7 21.25a.75.75 0 000 1.5h10a.75.75 0 000-1.5H7z" />
    </svg>
  );
}

function GestorIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M4.5 4A2.5 2.5 0 002 6.5v8A2.5 2.5 0 004.5 17H7v2.25a.75.75 0 001.22.57L12 17h7.5A2.5 2.5 0 0022 14.5v-8A2.5 2.5 0 0019.5 4h-15zM5 6.5A1.5 1.5 0 016.5 5h11A1.5 1.5 0 0119 6.5v8A1.5 1.5 0 0117.5 16H11a.75.75 0 00-.47.17L8.5 17.96V16H6.5A1.5 1.5 0 015 14.5v-8z" />
      <path d="M8.75 8a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5H12a.75.75 0 000-1.5H8.75z" />
    </svg>
  );
}

function LibraryIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M5.25 3A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21h4.5a.75.75 0 000-1.5h-4.5a.75.75 0 01-.75-.75V5.25a.75.75 0 01.75-.75h4.5a.75.75 0 000-1.5zm9 0a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 0014.25 21h4.5A2.25 2.25 0 0021 18.75V5.25A2.25 2.25 0 0018.75 3zm0 1.5h4.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75V5.25a.75.75 0 01.75-.75zM6 6.75a.75.75 0 01.75-.75h2.25a.75.75 0 010 1.5H6.75A.75.75 0 016 6.75zm0 3.5a.75.75 0 01.75-.75h2.25a.75.75 0 010 1.5H6.75A.75.75 0 016 10.25zm8.25 0a.75.75 0 01.75-.75h2.25a.75.75 0 010 1.5H15a.75.75 0 01-.75-.75zm0 3.5a.75.75 0 01.75-.75h2.25a.75.75 0 010 1.5H15a.75.75 0 01-.75-.75z" />
    </svg>
  );
}

function InsightsIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7.5A2.5 2.5 0 016.5 5h11A2.5 2.5 0 0120 7.5v9A2.5 2.5 0 0117.5 19h-11A2.5 2.5 0 014 16.5z"
      />
      <path strokeWidth="1.6" strokeLinecap="round" d="M8 12l2.5 2.5L16 9" />
    </svg>
  );
}

function ChatbotIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 2a3 3 0 00-3 3v.75H5.75A2.75 2.75 0 003 8.5v6A2.75 2.75 0 005.75 17H6v2.086A.914.914 0 007.414 19.5L10.914 17H15a3 3 0 003-3v-.439l1.553.777A1.25 1.25 0 0020 12.192V8.5A2.75 2.75 0 0017.25 5.75H17V5a3 3 0 00-3-3H9zm0 1.5h5A1.5 1.5 0 0115.5 5v.75h-7V5A1.5 1.5 0 019 3.5zm-2 5.25a.75.75 0 010 1.5h-.5a.75.75 0 010-1.5h.5zm9.25 0a.75.75 0 010 1.5h-.5a.75.75 0 010-1.5h.5zM9.75 12a.75.75 0 00-.75.75c0 .966.784 1.75 1.75 1.75h3.5a1.75 1.75 0 001.75-1.75.75.75 0 00-.75-.75h-5.5z" />
    </svg>
  );
}

function NeuralUniverseIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.25" strokeWidth="1.6" />
      <circle cx="5.5" cy="7" r="1.75" strokeWidth="1.6" />
      <circle cx="18.5" cy="7" r="1.75" strokeWidth="1.6" />
      <circle cx="6.5" cy="18" r="1.75" strokeWidth="1.6" />
      <circle cx="17.5" cy="18" r="1.75" strokeWidth="1.6" />
      <path strokeWidth="1.6" strokeLinecap="round" d="M8.95 9.1L6.95 7.9M15.05 9.1l2-1.2M9.45 14.6l-2 2.1M14.55 14.6l2 2.1" />
    </svg>
  );
}

function RadarIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.5" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <path strokeWidth="1.6" strokeLinecap="round" d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2" />
    </svg>
  );
}

function CardIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" strokeWidth="1.6" />
      <path strokeWidth="1.6" strokeLinecap="round" d="M3 9h18" />
      <path strokeWidth="1.6" strokeLinecap="round" d="M7 14h4" />
    </svg>
  );
}

function BankIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5" />
      <path strokeWidth="1.6" strokeLinecap="round" d="M5 10.5V20h14V10.5" />
      <path strokeWidth="1.6" strokeLinecap="round" d="M3 20h18" />
      <path strokeWidth="1.6" strokeLinecap="round" d="M9 20v-6h6v6" />
    </svg>
  );
}

function SettingsIcon({ className }) {
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

function SearchIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6" strokeWidth="1.6" />
      <path strokeWidth="1.6" strokeLinecap="round" d="M16.5 16.5L20 20" />
    </svg>
  );
}

function InstallIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M12 3v10m0 0l-3-3m3 3l3-3" />
      <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M5 15.75v1.5A1.75 1.75 0 006.75 19h10.5A1.75 1.75 0 0019 17.25v-1.5" />
    </svg>
  );
}

function MenuIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 6.75A.75.75 0 014.75 6h14.5a.75.75 0 010 1.5H4.75A.75.75 0 014 6.75zm0 5A.75.75 0 014.75 11h14.5a.75.75 0 010 1.5H4.75A.75.75 0 014 11.75zm0 5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H4.75A.75.75 0 014 16.75z" />
    </svg>
  );
}

function CloseIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M6.225 4.811a.75.75 0 011.06 0L12 9.525l4.715-4.714a.75.75 0 011.06 1.06L13.06 10.586l4.715 4.714a.75.75 0 11-1.06 1.06L12 11.646l-4.715 4.714a.75.75 0 11-1.06-1.06l4.714-4.715-4.714-4.714a.75.75 0 010-1.06z" />
    </svg>
  );
}
