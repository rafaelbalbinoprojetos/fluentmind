import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import {
  DEFAULT_MOBILE_NAV_PATHS,
  MOBILE_NAV_LINKS,
  sanitizeMobileNavSelection,
} from "../data/navigation.js";
import { getOrCreateLearningProfile, updateLearningProfile } from "../services/learningProgress.js";
import { resetProgression } from "../services/progressionEngine.js";
import { clearLearningEvents, seedLearningEvents } from "../services/learningEventEngine.js";

const PRACTICE_GOAL_OPTIONS = [
  { value: "expressions", label: "Salvar expressoes", description: "Priorize novos MindBlocks durante conversas." },
  { value: "review", label: "Revisar todos os dias", description: "Mantenha a memoria ativa com revisoes curtas." },
  { value: "conversation", label: "Conversar com IA", description: "Treine respostas naturais em contextos reais." },
];

const LEVEL_OPTIONS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function SettingsPage() {
  const { user, updateUserMetadata, subscription } = useAuth();
  const metadata = useMemo(() => user?.user_metadata ?? {}, [user]);
  const { effectivePlan = "free", hasLifetimeAccess = false, isMasterUser = false } = subscription ?? {};
  const storedMobileNav = useMemo(() => {
    const sanitized = sanitizeMobileNavSelection(metadata.mobile_nav_paths);
    return sanitized.length > 0 ? sanitized : DEFAULT_MOBILE_NAV_PATHS;
  }, [metadata]);
  const learningMetadata = useMemo(() => metadata.learning_preferences ?? {}, [metadata]);
  const [learningProfile, setLearningProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const initialLearning = useMemo(
    () => ({
      dailyGoal: String(learningProfile?.daily_expression_goal ?? learningMetadata.dailyGoal ?? 30),
      currentLevel: learningProfile?.current_level ?? learningMetadata.currentLevel ?? "A2",
      targetLanguage: learningProfile?.target_language ?? learningMetadata.targetLanguage ?? "en",
      practiceFocus: learningMetadata.practiceFocus ?? "expressions",
      showToasts: learningMetadata.showToasts !== false,
    }),
    [learningMetadata, learningProfile],
  );

  const [mobileNavSelection, setMobileNavSelection] = useState(storedMobileNav);
  const [mobileNavSaving, setMobileNavSaving] = useState(false);
  const mobileNavSelectionSet = useMemo(() => new Set(mobileNavSelection), [mobileNavSelection]);
  const mobileNavDirty = useMemo(() => {
    if (storedMobileNav.length !== mobileNavSelection.length) return true;
    return storedMobileNav.some((path, index) => path !== mobileNavSelection[index]);
  }, [mobileNavSelection, storedMobileNav]);

  const [displayName, setDisplayName] = useState(() => metadata.display_name ?? "");
  const [assistantName, setAssistantName] = useState(() => metadata.assistant_name ?? "Neo");
  const [assistantVoice, setAssistantVoice] = useState(() => metadata.assistant_voice ?? "mineirinha");
  const [chatTone, setChatTone] = useState(() => metadata.chat_tone ?? "natural");
  const [mindBlockSaveMode, setMindBlockSaveMode] = useState(() => metadata.mindblock_save_mode ?? "ask");
  const [profileSaving, setProfileSaving] = useState(false);
  const profileDirty =
    displayName.trim() !== (metadata.display_name ?? "") ||
    assistantName.trim() !== (metadata.assistant_name ?? "Neo") ||
    assistantVoice !== (metadata.assistant_voice ?? "mineirinha") ||
    mindBlockSaveMode !== (metadata.mindblock_save_mode ?? "ask") ||
    chatTone !== (metadata.chat_tone ?? "natural");

  const [learningForm, setLearningForm] = useState(initialLearning);
  const [learningSaving, setLearningSaving] = useState(false);
  const learningDirty = useMemo(
    () =>
      learningForm.dailyGoal !== initialLearning.dailyGoal ||
      learningForm.currentLevel !== initialLearning.currentLevel ||
      learningForm.targetLanguage !== initialLearning.targetLanguage ||
      learningForm.practiceFocus !== initialLearning.practiceFocus ||
      learningForm.showToasts !== initialLearning.showToasts,
    [learningForm, initialLearning],
  );

  useEffect(() => {
    let ignore = false;

    async function loadLearningProfile() {
      if (!user?.id) {
        setProfileLoading(false);
        return;
      }

      try {
        setProfileLoading(true);
        const profile = await getOrCreateLearningProfile(user);
        if (!ignore) setLearningProfile(profile);
      } catch (error) {
        console.error("Erro ao carregar perfil de aprendizado:", error);
        toast.error("Nao foi possivel carregar o perfil de aprendizado.");
      } finally {
        if (!ignore) setProfileLoading(false);
      }
    }

    loadLearningProfile();
    return () => {
      ignore = true;
    };
  }, [user]);

  useEffect(() => {
    setMobileNavSelection(storedMobileNav);
  }, [storedMobileNav]);

  useEffect(() => {
    setLearningForm(initialLearning);
  }, [initialLearning]);

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    if (!profileDirty || !updateUserMetadata) return;
    try {
      setProfileSaving(true);
      await updateUserMetadata({
        display_name: displayName.trim(),
        assistant_name: assistantName.trim() || "Neo",
        assistant_voice: assistantVoice,
        mindblock_save_mode: mindBlockSaveMode,
        chat_tone: chatTone,
      });
      if (user?.id) {
        const updatedProfile = await updateLearningProfile(user.id, {
          display_name: displayName.trim(),
        });
        setLearningProfile(updatedProfile);
      }
      toast.success("Perfil atualizado.");
    } catch (error) {
      console.error(error);
      toast.error("Nao foi possivel salvar o perfil.");
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
      return sanitizeMobileNavSelection([...prev, path]);
    });
    if (blocked) {
      toast.error("Selecione pelo menos um atalho.");
    }
  };

  const handleSaveMobileNav = async (event) => {
    event.preventDefault();
    if (!mobileNavDirty || !updateUserMetadata) return;
    const sanitized = sanitizeMobileNavSelection(mobileNavSelection);
    if (sanitized.length === 0) {
      toast.error("Selecione pelo menos um atalho.");
      return;
    }

    try {
      setMobileNavSaving(true);
      await updateUserMetadata({ mobile_nav_paths: sanitized });
      toast.success("Menu mobile atualizado.");
    } catch (error) {
      console.error("Erro ao salvar menu mobile:", error);
      toast.error("Nao foi possivel salvar o menu agora.");
    } finally {
      setMobileNavSaving(false);
    }
  };

  const handleSaveLearning = async (event) => {
    event.preventDefault();
    if (!learningDirty || !updateUserMetadata) return;
    const dailyGoal = Math.max(1, Number.parseInt(learningForm.dailyGoal, 10) || 30);

    try {
      setLearningSaving(true);
      await updateUserMetadata({
        learning_preferences: {
          dailyGoal,
          currentLevel: learningForm.currentLevel,
          targetLanguage: learningForm.targetLanguage,
          practiceFocus: learningForm.practiceFocus,
          showToasts: learningForm.showToasts,
        },
      });
      if (user?.id) {
        const updatedProfile = await updateLearningProfile(user.id, {
          display_name: displayName.trim() || metadata.display_name || user.email?.split("@")[0] || null,
          current_level: learningForm.currentLevel,
          target_language: learningForm.targetLanguage,
          daily_expression_goal: dailyGoal,
          last_active_date: new Date().toISOString().slice(0, 10),
        });
        setLearningProfile(updatedProfile);
      }
      toast.success("Preferencias de estudo atualizadas.");
    } catch (error) {
      console.error("Erro ao salvar preferencias de estudo:", error);
      toast.error("Nao foi possivel salvar as preferencias agora.");
    } finally {
      setLearningSaving(false);
    }
  };

  const handleResetProgression = () => {
    const confirmed = window.confirm("Resetar XP, nivel, missoes diarias e conquistas locais?");
    if (!confirmed) return;
    resetProgression();
    toast.success("Progressao local resetada.");
  };

  const handleSeedLearningEvents = () => {
    const events = seedLearningEvents();
    toast.success(`${events.length} eventos de aprendizado criados.`);
  };

  const handleClearLearningEvents = () => {
    const confirmed = window.confirm("Limpar eventos locais que alimentam o Neural Universe?");
    if (!confirmed) return;
    clearLearningEvents();
    toast.success("Eventos locais limpos.");
  };

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Configuracoes</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Ajuste perfil, pratica diaria, notificacoes e atalhos do FluentMind.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Plano atual: {hasLifetimeAccess ? "Ultra vitalicio" : effectivePlan === "premium" ? "Premium" : "Gratuito"}.
          {isMasterUser ? " Conta administradora." : ""}
          {profileLoading ? " Carregando perfil de aprendizado..." : ""}
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <form
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          onSubmit={handleSaveProfile}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Perfil e assistente</h2>
          <div className="mt-6 space-y-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Seu nome
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Como prefere ser chamado(a)?"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
              <span className="mt-1 block text-xs text-gray-400 dark:text-gray-500">
                O Neo usa esse nome nas conversas e revisoes.
              </span>
            </label>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Nome do assistente
              <input
                type="text"
                value={assistantName}
                onChange={(event) => setAssistantName(event.target.value)}
                placeholder="Neo, Emma, Coach..."
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
              <span className="mt-1 block text-xs text-gray-400 dark:text-gray-500">
                Esse nome aparece no chatbot e nas mensagens de pratica.
              </span>
            </label>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Voz preferida
              <select
                value={assistantVoice}
                onChange={(event) => setAssistantVoice(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                <option value="mineirinha">Mineirinha</option>
                <option value="female">Feminina neutra</option>
                <option value="male">Masculina neutra</option>
              </select>
              <span className="mt-1 block text-xs text-gray-400 dark:text-gray-500">
                Preparado para integrar com ElevenLabs nas proximas etapas.
              </span>
            </label>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Tom do assistente</p>
              <div className="flex flex-col gap-2">
                {[
                  { value: "formal", label: "Formal", description: "Respostas objetivas e estruturadas." },
                  { value: "natural", label: "Natural", description: "Conversa leve, clara e direta." },
                  { value: "coach", label: "Coach de fluencia", description: "Mais incentivo, exemplos e correcao suave." },
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
                    <span>
                      <span className="block font-medium text-gray-900 dark:text-gray-100">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Salvar MindBlocks pelo chatbot</p>
              <div className="grid gap-2">
                {[
                  { value: "ask", label: "Perguntar antes de salvar", description: "Mostra Salvar, Editar e Ignorar em cada sugestao." },
                  { value: "auto", label: "Salvar automaticamente", description: "Salva expressoes detectadas sem abrir modal." },
                  { value: "never", label: "Nunca sugerir salvamento", description: "Mantem o chat limpo e nao exibe sugestoes." },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                      mindBlockSaveMode === option.value
                        ? "border-temaSky bg-temaSky/5 dark:border-temaEmerald dark:bg-temaEmerald/10"
                        : "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="mindBlockSaveMode"
                      value={option.value}
                      checked={mindBlockSaveMode === option.value}
                      onChange={() => setMindBlockSaveMode(option.value)}
                      className="mt-0.5 accent-temaSky dark:accent-temaEmerald"
                    />
                    <span>
                      <span className="block font-medium text-gray-900 dark:text-gray-100">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={profileSaving || !profileDirty}
              className="inline-flex items-center justify-center rounded-md bg-temaSky px-4 py-2 text-sm font-semibold text-white transition hover:bg-temaSky-dark disabled:cursor-not-allowed disabled:opacity-60 dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark"
            >
              {profileSaving ? "Salvando..." : "Salvar perfil"}
            </button>
          </div>
        </form>

        <form
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          onSubmit={handleSaveLearning}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pratica diaria</h2>
          <div className="mt-6 space-y-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Meta diaria de expressoes
              <input
                type="number"
                min="1"
                step="1"
                value={learningForm.dailyGoal}
                onChange={(event) => setLearningForm((prev) => ({ ...prev, dailyGoal: event.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nivel atual
                <select
                  value={learningForm.currentLevel}
                  onChange={(event) => setLearningForm((prev) => ({ ...prev, currentLevel: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  {LEVEL_OPTIONS.map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
                <span className="mt-1 block text-xs text-gray-400 dark:text-gray-500">
                  Usado para calibrar revisoes, respostas e dificuldade.
                </span>
              </label>

              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Idioma alvo
                <select
                  value={learningForm.targetLanguage}
                  onChange={(event) => setLearningForm((prev) => ({ ...prev, targetLanguage: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option value="en">Inglês</option>
                  <option value="es">Espanhol</option>
                  <option value="fr">Francês</option>
                  <option value="de">Alemão</option>
                  <option value="it">Italiano</option>
                </select>
                <span className="mt-1 block text-xs text-gray-400 dark:text-gray-500">
                  A base atual está otimizada para inglês.
                </span>
              </label>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Foco principal</p>
              <div className="grid gap-2">
                {PRACTICE_GOAL_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                      learningForm.practiceFocus === option.value
                        ? "border-temaSky bg-temaSky/5 dark:border-temaEmerald dark:bg-temaEmerald/10"
                        : "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="practiceFocus"
                      checked={learningForm.practiceFocus === option.value}
                      onChange={() => setLearningForm((prev) => ({ ...prev, practiceFocus: option.value }))}
                      className="mt-0.5 accent-temaSky dark:accent-temaEmerald"
                    />
                    <span>
                      <span className="block font-medium text-gray-900 dark:text-gray-100">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800/50">
              <span>
                <span className="block font-medium text-gray-900 dark:text-gray-100">Notificacoes de estudo</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  Mostrar lembretes e sugestoes dentro do app.
                </span>
              </span>
              <input
                type="checkbox"
                checked={learningForm.showToasts}
                onChange={() => setLearningForm((prev) => ({ ...prev, showToasts: !prev.showToasts }))}
                className="h-4 w-4 rounded border-gray-300 text-temaSky focus:ring-temaSky dark:border-gray-600 dark:bg-gray-900 dark:text-temaEmerald"
              />
            </label>

            <button
              type="submit"
              disabled={learningSaving || !learningDirty}
              className="inline-flex items-center justify-center rounded-md bg-temaSky px-4 py-2 text-sm font-semibold text-white transition hover:bg-temaSky-dark disabled:cursor-not-allowed disabled:opacity-60 dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark"
            >
              {learningSaving ? "Salvando..." : "Salvar pratica"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <form className="flex flex-col gap-6" onSubmit={handleSaveMobileNav}>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Menu inferior no mobile</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Escolha os atalhos exibidos no menu inferior em celulares e tablets.
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
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-temaSky focus:ring-temaSky dark:border-gray-600 dark:bg-gray-900 dark:text-temaEmerald"
                    checked={checked}
                    onChange={() => handleToggleMobileNav(link.to)}
                  />
                  <span>
                    <span className="block font-semibold text-gray-900 dark:text-gray-100">{link.label}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">Atalho: {link.shortLabel}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {mobileNavSelection.length} {mobileNavSelection.length === 1 ? "atalho selecionado" : "atalhos selecionados"}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMobileNavSelection(DEFAULT_MOBILE_NAV_PATHS)}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                disabled={
                  mobileNavSaving ||
                  (mobileNavSelection.length === DEFAULT_MOBILE_NAV_PATHS.length &&
                    mobileNavSelection.every((path, index) => path === DEFAULT_MOBILE_NAV_PATHS[index]))
                }
              >
                Restaurar padrao
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-temaSky px-4 py-2 text-xs font-semibold text-white transition hover:bg-temaSky-dark disabled:cursor-not-allowed disabled:opacity-60 dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark"
                disabled={mobileNavSaving || !mobileNavDirty}
              >
                {mobileNavSaving ? "Salvando..." : "Salvar menu"}
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Progression Engine</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              XP, nivel, missoes e conquistas ficam em localStorage nesta etapa.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetProgression}
            className="inline-flex items-center justify-center rounded-md border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/50 dark:text-rose-300 dark:hover:bg-rose-500/10"
          >
            Resetar progressao local
          </button>
          <button
            type="button"
            onClick={handleSeedLearningEvents}
            className="inline-flex items-center justify-center rounded-md border border-sky-300 px-4 py-2 text-xs font-semibold text-sky-600 transition hover:bg-sky-50 dark:border-sky-500/50 dark:text-sky-300 dark:hover:bg-sky-500/10"
          >
            Seed Learning Events
          </button>
          <button
            type="button"
            onClick={handleClearLearningEvents}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Limpar eventos locais
          </button>
        </div>
      </section>
    </div>
  );
}
