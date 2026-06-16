import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import { deleteAllRevenuesByUser } from "../services/revenues.js";
import { deleteAllExpensesByUser, deleteCardExpensesByUser } from "../services/expenses.js";
import {
  DEFAULT_MOBILE_NAV_PATHS,
  MOBILE_NAV_LINKS,
  sanitizeMobileNavSelection,
} from "../data/navigation.js";

function normalizeGoalValue(value) {
  if (value === null || value === undefined || value === "") return 0;
  const numeric = Number(String(value).replace(/[^0-9.,-]/g, "").replace(",", "."));
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, numeric);
}

function formatGoalInput(value) {
  if (value === null || value === undefined) return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return "";
  }
  return String(numeric);
}

export default function SettingsPage() {
  const { user, updateUserMetadata, subscription } = useAuth();
  const metadata = useMemo(() => user?.user_metadata ?? {}, [user]);
  const {
    plan = "free",
    effectivePlan = "free",
    hasPremiumAccess = false,
    canStartTrial = true,
    hasLifetimeAccess = false,
  } = subscription ?? {};
  const storedMobileNav = useMemo(() => {
    const sanitized = sanitizeMobileNavSelection(metadata.mobile_nav_paths);
    if (sanitized.length > 0) {
      return sanitized;
    }
    return DEFAULT_MOBILE_NAV_PATHS;
  }, [metadata]);
  const goalsMetadata = useMemo(() => metadata.financial_goals ?? {}, [metadata]);
  const initialGoals = useMemo(
    () => ({
      monthlyInvestmentTarget: normalizeGoalValue(goalsMetadata.monthlyInvestmentTarget),
      monthlyExpenseLimit: normalizeGoalValue(goalsMetadata.monthlyExpenseLimit),
      savingsGoal: normalizeGoalValue(goalsMetadata.savingsGoal),
    }),
    [goalsMetadata],
  );
  const alertMetadata = useMemo(() => metadata.alert_preferences ?? {}, [metadata]);
  const initialAlerts = useMemo(
    () => ({
      showToasts: alertMetadata.show_toasts !== false,
    }),
    [alertMetadata],
  );
  const [mobileNavSelection, setMobileNavSelection] = useState(storedMobileNav);
  const [mobileNavSaving, setMobileNavSaving] = useState(false);
  const mobileNavSelectionSet = useMemo(() => new Set(mobileNavSelection), [mobileNavSelection]);
  const mobileNavDirty = useMemo(() => {
    if (storedMobileNav.length !== mobileNavSelection.length) {
      return true;
    }
    return storedMobileNav.some((path, index) => path !== mobileNavSelection[index]);
  }, [mobileNavSelection, storedMobileNav]);
  const [goalsForm, setGoalsForm] = useState(() => ({
    monthlyInvestmentTarget: formatGoalInput(initialGoals.monthlyInvestmentTarget),
    monthlyExpenseLimit: formatGoalInput(initialGoals.monthlyExpenseLimit),
    savingsGoal: formatGoalInput(initialGoals.savingsGoal),
  }));
  const [goalsSaving, setGoalsSaving] = useState(false);
  const goalsFormSanitized = useMemo(
    () => ({
      monthlyInvestmentTarget: normalizeGoalValue(goalsForm.monthlyInvestmentTarget),
      monthlyExpenseLimit: normalizeGoalValue(goalsForm.monthlyExpenseLimit),
      savingsGoal: normalizeGoalValue(goalsForm.savingsGoal),
    }),
    [goalsForm],
  );
  const goalsDirty = useMemo(() => {
    return (
      goalsFormSanitized.monthlyInvestmentTarget !== initialGoals.monthlyInvestmentTarget ||
      goalsFormSanitized.monthlyExpenseLimit !== initialGoals.monthlyExpenseLimit ||
      goalsFormSanitized.savingsGoal !== initialGoals.savingsGoal
    );
  }, [goalsFormSanitized, initialGoals]);
  const goalsResetDisabled =
    goalsSaving ||
    (goalsFormSanitized.monthlyInvestmentTarget === 0 &&
      goalsFormSanitized.monthlyExpenseLimit === 0 &&
      goalsFormSanitized.savingsGoal === 0);
  const [alertsForm, setAlertsForm] = useState(() => ({
    showToasts: initialAlerts.showToasts,
  }));
  const [alertsSaving, setAlertsSaving] = useState(false);
  const alertsDirty = useMemo(() => alertsForm.showToasts !== initialAlerts.showToasts, [alertsForm, initialAlerts]);
  const [cleanupLoading, setCleanupLoading] = useState({
    revenues: false,
    expenses: false,
    cardExpenses: false,
  });

  // ─── Perfil + Tom do assistente ───────────────────────────────────────────
  const [displayName, setDisplayName] = useState(() => metadata.display_name ?? "");
  const [chatTone, setChatTone] = useState(() => metadata.chat_tone ?? "natural");
  const [profileSaving, setProfileSaving] = useState(false);
  const profileDirty =
    displayName.trim() !== (metadata.display_name ?? "") ||
    chatTone !== (metadata.chat_tone ?? "natural");

  useEffect(() => {
    setMobileNavSelection(storedMobileNav);
  }, [storedMobileNav]);
  useEffect(() => {
    setGoalsForm({
      monthlyInvestmentTarget: formatGoalInput(initialGoals.monthlyInvestmentTarget),
      monthlyExpenseLimit: formatGoalInput(initialGoals.monthlyExpenseLimit),
      savingsGoal: formatGoalInput(initialGoals.savingsGoal),
    });
  }, [
    initialGoals.monthlyInvestmentTarget,
    initialGoals.monthlyExpenseLimit,
    initialGoals.savingsGoal,
  ]);
  useEffect(() => {
    setAlertsForm({ showToasts: initialAlerts.showToasts });
  }, [initialAlerts.showToasts]);

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    if (!profileDirty || !updateUserMetadata) return;
    try {
      setProfileSaving(true);
      await updateUserMetadata({ display_name: displayName.trim(), chat_tone: chatTone });
      toast.success("Perfil atualizado.");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível salvar o perfil.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleToggleMobileNav = (path) => {
    let blocked = false;
    setMobileNavSelection((prev) => {
      const exists = prev.includes(path);
      if (exists) {
        if (prev.length <= 1) {
          blocked = true;
          return prev;
        }
        const next = prev.filter((value) => value !== path);
        const sanitized = sanitizeMobileNavSelection(next);
        return sanitized.length > 0 ? sanitized : prev;
      }
      const next = [...prev, path];
      return sanitizeMobileNavSelection(next);
    });
    if (blocked) {
      toast.error("Selecione pelo menos um atalho.");
    }
  };

  const handleGoalInputChange = (event) => {
    const { name, value } = event.target;
    setGoalsForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleResetGoals = () => {
    setGoalsForm({
      monthlyInvestmentTarget: "",
      monthlyExpenseLimit: "",
      savingsGoal: "",
    });
  };

  const handleAlertsToggle = () => {
    setAlertsForm((prev) => ({ showToasts: !prev.showToasts }));
  };

  const handleSaveAlerts = async (event) => {
    event.preventDefault();
    if (!alertsDirty || !updateUserMetadata) {
      return;
    }

    try {
      setAlertsSaving(true);
      await updateUserMetadata({
        alert_preferences: {
          show_toasts: alertsForm.showToasts,
        },
      });
      toast.success("Preferencias de alertas atualizadas.");
    } catch (error) {
      console.error("Erro ao salvar preferencia de alertas:", error);
      toast.error("Nao foi possivel atualizar os alertas agora.");
    } finally {
      setAlertsSaving(false);
    }
  };

  const handleSaveGoals = async (event) => {
    event.preventDefault();
    if (!goalsDirty || !updateUserMetadata) {
      return;
    }
    const payload = {
      monthlyInvestmentTarget: goalsFormSanitized.monthlyInvestmentTarget,
      monthlyExpenseLimit: goalsFormSanitized.monthlyExpenseLimit,
      savingsGoal: goalsFormSanitized.savingsGoal,
    };

    try {
      setGoalsSaving(true);
      await updateUserMetadata({ financial_goals: payload });
      toast.success("Metas financeiras atualizadas.");
    } catch (error) {
      console.error("Erro ao salvar metas financeiras:", error);
      toast.error("Nao foi possivel salvar as metas agora.");
    } finally {
      setGoalsSaving(false);
    }
  };

  const handleResetMobileNav = () => {
    setMobileNavSelection(DEFAULT_MOBILE_NAV_PATHS);
  };

  const handleSaveMobileNav = async (event) => {
    event.preventDefault();
    if (!mobileNavDirty || !updateUserMetadata) {
      return;
    }
    const sanitized = sanitizeMobileNavSelection(mobileNavSelection);
    if (sanitized.length === 0) {
      toast.error("Selecione pelo menos um atalho.");
      return;
    }

    try {
      setMobileNavSaving(true);
      await updateUserMetadata({ mobile_nav_paths: sanitized });
      toast.success("Preferencias do menu inferior atualizadas.");
    } catch (error) {
      console.error("Erro ao salvar menu mobile:", error);
      toast.error("Nao foi possivel salvar as preferencias agora.");
    } finally {
      setMobileNavSaving(false);
    }
  };

  const openPlans = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("granaapp:open-plans"));
    }
  };

  const activateTrial = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("granaapp:activate-trial"));
    }
  };

  const runCleanupAction = async ({ key, title, action, successMessage }) => {
    if (!user?.id) {
      toast.error("Usuário não identificado.");
      return;
    }
    const firstConfirm = window.confirm(`${title}\n\nEsta ação não pode ser desfeita.`);
    if (!firstConfirm) return;
    const secondConfirm = window.confirm("Confirma a exclusão definitiva?");
    if (!secondConfirm) return;

    setCleanupLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await action(user.id);
      toast.success(successMessage);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Não foi possível concluir a exclusão.");
    } finally {
      setCleanupLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Configuracoes</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Ajuste preferencias gerais, limites de alerta e integracoes futuras.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Plano atual:{" "}
          {hasLifetimeAccess
            ? "Ultra (vitalício)"
            : effectivePlan === "premium"
              ? "Premium"
              : "Gratuito"}.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <form
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          onSubmit={handleSaveProfile}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Preferências de conta</h2>
          <div className="mt-6 space-y-5">

            {/* Nome do usuário */}
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Seu nome
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Como prefere ser chamado(a)?"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
              />
              <span className="mt-1 block text-xs text-gray-400 dark:text-gray-500">
                O assistente irá te chamar por esse nome nas conversas.
              </span>
            </label>

            {/* Tom do assistente */}
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tom do assistente</p>
              <div className="flex flex-col gap-2">
                {[
                  {
                    value: "formal",
                    label: "Formal",
                    description: "Linguagem profissional e objetiva, estilo consultor financeiro.",
                  },
                  {
                    value: "natural",
                    label: "Natural",
                    description: "Conversa leve e fluida, como um amigo inteligente.",
                  },
                  {
                    value: "mineiro_descontraido",
                    label: "Descontraído Mineiro",
                    description: "Acolhedor, com humor sutil e expressões mineiras ocasionais.",
                  },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                      chatTone === option.value
                        ? "border-temaSky bg-temaSky/5 dark:border-temaEmerald dark:bg-temaEmerald/10"
                        : "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="chatTone"
                      value={option.value}
                      checked={chatTone === option.value}
                      onChange={() => setChatTone(option.value)}
                      className="mt-0.5 accent-temaSky dark:accent-temaEmerald"
                    />
                    <div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{option.label}</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={profileSaving || !profileDirty}
              className="inline-flex items-center justify-center rounded-md bg-temaSky px-4 py-2 text-sm font-semibold text-white transition hover:bg-temaSky-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-temaSky/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark dark:focus-visible:ring-temaEmerald/40"
            >
              {profileSaving ? "Salvando..." : "Salvar preferências"}
            </button>
          </div>
        </form>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Alertas financeiros</h2>
          <ul className="mt-4 space-y-4 text-sm text-gray-600 dark:text-gray-300">
            <li className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-2.5 w-2.5 flex-none rounded-full bg-rose-500" aria-hidden="true" />
              Configure avisos de caixa baixo usando react-hot-toast quando o saldo projetado ficar negativo.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-2.5 w-2.5 flex-none rounded-full bg-amber-500" aria-hidden="true" />
              Crie alertas para vencimentos de contas com base em dias de antecedencia predefinidos.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-2.5 w-2.5 flex-none rounded-full bg-emerald-500" aria-hidden="true" />
              Integre webhooks do Supabase para receber alertas externos em canais como Slack.
            </li>
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <form className="flex flex-col gap-6" onSubmit={handleSaveMobileNav}>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Menu inferior (mobile)</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Escolha os atalhos exibidos no menu inferior em dispositivos moveis. Pelo menos um item deve permanecer ativo.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {MOBILE_NAV_LINKS.map((link) => {
              const checked = mobileNavSelectionSet.has(link.to);
              return (
                <label
                  key={link.to}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                    checked
                      ? "border-temaSky/60 bg-temaSky/5 text-temaSky dark:border-temaEmerald/60 dark:bg-temaEmerald/10 dark:text-temaEmerald"
                      : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-temaSky focus:ring-temaSky dark:border-gray-600 dark:bg-gray-900 dark:text-temaEmerald dark:focus:ring-temaEmerald"
                    checked={checked}
                    onChange={() => handleToggleMobileNav(link.to)}
                  />
                  <div className="space-y-1">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{link.label}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">Atalho: {link.shortLabel}</span>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {mobileNavSelection.length}{" "}
              {mobileNavSelection.length === 1 ? "atalho selecionado" : "atalhos selecionados"}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleResetMobileNav}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-temaSky/30 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 dark:focus-visible:ring-temaEmerald/30"
                disabled={mobileNavSaving || (mobileNavSelection.length === DEFAULT_MOBILE_NAV_PATHS.length &&
                  mobileNavSelection.every((path, index) => path === DEFAULT_MOBILE_NAV_PATHS[index]))}
              >
                Restaurar padrao
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-temaSky px-4 py-2 text-xs font-semibold text-white transition hover:bg-temaSky-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-temaSky/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark dark:focus-visible:ring-temaEmerald/40"
                disabled={mobileNavSaving || !mobileNavDirty}
              >
                {mobileNavSaving ? "Salvando..." : "Salvar menu"}
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <form className="flex flex-col gap-6" onSubmit={handleSaveAlerts}>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Alertas automáticos</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ative ou desative notificações em tempo real disparadas pelo gestor financeiro no dashboard.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Mostrar alertas via toast</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Quando habilitado, alertas críticos aparecem na tela durante a análise do dashboard.
              </p>
            </div>
            <label className="relative inline-flex h-6 w-12 cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={alertsForm.showToasts}
                onChange={handleAlertsToggle}
              />
              <span className="h-6 w-12 rounded-full bg-gray-300 transition peer-checked:bg-temaSky dark:bg-gray-700 dark:peer-checked:bg-temaEmerald" />
              <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-6" />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-temaSky px-4 py-2 text-xs font-semibold text-white transition hover:bg-temaSky-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-temaSky/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark dark:focus-visible:ring-temaEmerald/40"
              disabled={alertsSaving || !alertsDirty}
            >
              {alertsSaving ? "Salvando..." : "Salvar alertas"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <form className="flex flex-col gap-6" onSubmit={handleSaveGoals}>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Metas financeiras</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Defina objetivos mensais para orientar o gestor financeiro. Valores iguais a zero deixam a meta desativada.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              Meta de investimentos (R$)
              <input
                type="number"
                name="monthlyInvestmentTarget"
                min="0"
                step="0.01"
                value={goalsForm.monthlyInvestmentTarget}
                onChange={handleGoalInputChange}
                placeholder="Ex.: 500"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              Limite de despesas (R$)
              <input
                type="number"
                name="monthlyExpenseLimit"
                min="0"
                step="0.01"
                value={goalsForm.monthlyExpenseLimit}
                onChange={handleGoalInputChange}
                placeholder="Ex.: 3500"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              Objetivo de sobra (R$)
              <input
                type="number"
                name="savingsGoal"
                min="0"
                step="0.01"
                value={goalsForm.savingsGoal}
                onChange={handleGoalInputChange}
                placeholder="Ex.: 1200"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Valores sao interpretados no periodo filtrado do dashboard. Deixe em branco para desativar.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleResetGoals}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-temaSky/30 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 dark:focus-visible:ring-temaEmerald/30"
                disabled={goalsResetDisabled}
              >
                Limpar metas
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-temaSky px-4 py-2 text-xs font-semibold text-white transition hover:bg-temaSky-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-temaSky/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark dark:focus-visible:ring-temaEmerald/40"
                disabled={goalsSaving || !goalsDirty}
              >
                {goalsSaving ? "Salvando..." : "Salvar metas"}
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-700 shadow-sm dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-100">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-1 gap-4">
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-white/60 text-emerald-500 dark:bg-emerald-900/40">
              <span className="text-xl" aria-hidden="true">
                🔒
              </span>
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">Backup e exportação (Premium)</h2>
              <p className="text-sm leading-relaxed">
                Automatize o backup diário dos seus dados e exporte tudo em CSV com um clique. Ideal para enviar ao contador, manter
                histórico em planilhas e integrar com outras ferramentas.
              </p>
              <ul className="space-y-1 text-xs text-emerald-700/90 dark:text-emerald-200/80">
                <li>• Backup seguro no Supabase Storage com histórico de versões.</li>
                <li>• Exportação CSV de lançamentos de despesas, rendas, investimentos e horas extras.</li>
                <li>• Relatórios inteligentes com filtros avançados e sugestão de insights.</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-none flex-col gap-2">
            {hasPremiumAccess ? (
              <span className="inline-flex items-center justify-center rounded-full bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                {hasLifetimeAccess
                  ? "Acesso Ultra vitalício ativo"
                  : plan === "premium"
                    ? "Plano Premium ativo"
                    : "teste Premium em andamento"}
              </span>
            ) : (
              <>
                {canStartTrial && (
                  <button
                    type="button"
                    onClick={activateTrial}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-emerald-500 hover:to-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                  >
                    testar Premium por 7 dias
                  </button>
                )}
                <button
                  type="button"
                  onClick={openPlans}
                  className="inline-flex items-center justify-center rounded-full border border-emerald-400/70 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:border-emerald-500/40 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                >
                  Ver planos Premium
                </button>
                {!canStartTrial && !hasPremiumAccess && (
                  <span className="text-[11px] text-emerald-600/80 dark:text-emerald-200/80">
                    Seu período de teste já foi utilizado. Faça upgrade quando estiver pronto.
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-rose-200 bg-rose-50 p-6 shadow-sm dark:border-rose-900/40 dark:bg-rose-950/20">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-rose-800 dark:text-rose-200">Zona de perigo</h2>
          <p className="text-sm text-rose-700/90 dark:text-rose-200/90">
            Exclua dados financeiros da sua conta atual. Essas ações são permanentes e afetam somente seu usuário.
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() =>
              runCleanupAction({
                key: "revenues",
                title: "Excluir todas as rendas da sua conta?",
                action: deleteAllRevenuesByUser,
                successMessage: "Todas as rendas foram excluídas.",
              })
            }
            disabled={cleanupLoading.revenues}
            className="inline-flex items-center justify-center rounded-lg border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-700/50 dark:bg-rose-950/20 dark:text-rose-200 dark:hover:bg-rose-900/40"
          >
            {cleanupLoading.revenues ? "Excluindo..." : "Excluir todas as rendas"}
          </button>
          <button
            type="button"
            onClick={() =>
              runCleanupAction({
                key: "expenses",
                title: "Excluir todas as despesas da sua conta?",
                action: deleteAllExpensesByUser,
                successMessage: "Todas as despesas foram excluídas.",
              })
            }
            disabled={cleanupLoading.expenses}
            className="inline-flex items-center justify-center rounded-lg border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-700/50 dark:bg-rose-950/20 dark:text-rose-200 dark:hover:bg-rose-900/40"
          >
            {cleanupLoading.expenses ? "Excluindo..." : "Excluir todas as despesas"}
          </button>
          <button
            type="button"
            onClick={() =>
              runCleanupAction({
                key: "cardExpenses",
                title: "Excluir somente as despesas de cartão da sua conta?",
                action: deleteCardExpensesByUser,
                successMessage: "Todas as despesas de cartão foram excluídas.",
              })
            }
            disabled={cleanupLoading.cardExpenses}
            className="inline-flex items-center justify-center rounded-lg border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-700/50 dark:bg-rose-950/20 dark:text-rose-200 dark:hover:bg-rose-900/40"
          >
            {cleanupLoading.cardExpenses ? "Excluindo..." : "Excluir despesas de cartão"}
          </button>
        </div>
      </section>

    </div>
  );
}
