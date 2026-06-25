import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Clock3,
  Headphones,
  Lock,
  MessageCircle,
  Play,
  Route,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import useProgression from "../hooks/useProgression.js";
import {
  getChapterChecklist,
  getInitialJourneyProgress,
  getOverallJourneyProgress,
  LEARNING_JOURNEY_KEY,
  learningJourneyChapters,
} from "../data/learningJourney.js";
import { createMindBlock } from "../services/mindblocks.js";
import { recordLearningEvent } from "../services/learningEventEngine.js";
import { addXp, trackProgressionAction } from "../services/progressionEngine.js";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function loadJourneyProgress() {
  if (!canUseStorage()) return getInitialJourneyProgress();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LEARNING_JOURNEY_KEY) || "null");
    return parsed ? { ...getInitialJourneyProgress(), ...parsed } : getInitialJourneyProgress();
  } catch {
    return getInitialJourneyProgress();
  }
}

function saveJourneyProgress(progress) {
  if (!canUseStorage()) return progress;
  window.localStorage.setItem(LEARNING_JOURNEY_KEY, JSON.stringify(progress));
  return progress;
}

function createChapterMindBlockPayload(chapter, [expression, translation]) {
  return {
    expression,
    translation,
    category: `Journey: ${chapter.title}`,
    source: "Learning Journey",
    context: chapter.objective,
    notes: `Saved from Learning Journey chapter ${chapter.order}: ${chapter.title}.`,
    meta: {
      usage: chapter.objective,
      examples: [`${expression} ${chapter.title === "About Me" ? "Nice to meet you." : ""}`.trim()],
      pattern: `${expression.split(" ").slice(0, 3).join(" ")} + context`,
      patternExplanation: chapter.intro,
      relatedExpressions: chapter.mindBlocks.slice(0, 3).map(([itemExpression, itemTranslation]) => ({
        expression: itemExpression,
        translation: itemTranslation,
      })),
      practice: chapter.finalChallenge,
    },
  };
}

export default function LearningJourneyPage() {
  const { user } = useAuth();
  const progression = useProgression();
  const [journeyProgress, setJourneyProgress] = useState(loadJourneyProgress);
  const [selectedChapterId, setSelectedChapterId] = useState(() => loadJourneyProgress().activeChapterId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    saveJourneyProgress(journeyProgress);
  }, [journeyProgress]);

  const completedSet = useMemo(() => new Set(journeyProgress.completedChapterIds || []), [journeyProgress.completedChapterIds]);
  const selectedChapter = learningJourneyChapters.find((chapter) => chapter.id === selectedChapterId) || learningJourneyChapters[0];
  const activeChapter = learningJourneyChapters.find((chapter) => chapter.id === journeyProgress.activeChapterId) || learningJourneyChapters[0];
  const selectedIndex = learningJourneyChapters.findIndex((chapter) => chapter.id === selectedChapter.id);
  const activeIndex = learningJourneyChapters.findIndex((chapter) => chapter.id === activeChapter.id);
  const isSelectedUnlocked = selectedIndex <= activeIndex || completedSet.has(selectedChapter.id);
  const checklist = getChapterChecklist(selectedChapter, journeyProgress);
  const chapterProgressPercent = Math.round((checklist.filter((item) => item.complete).length / checklist.length) * 100);
  const overallProgress = getOverallJourneyProgress(journeyProgress);
  const totalXp = learningJourneyChapters.reduce((sum, chapter) => sum + chapter.xp, 0);
  const earnedJourneyXp = learningJourneyChapters
    .filter((chapter) => completedSet.has(chapter.id))
    .reduce((sum, chapter) => sum + chapter.xp, 0);

  const updateChapterStep = (stepId, value = true) => {
    setJourneyProgress((current) => ({
      ...current,
      chapterProgress: {
        ...current.chapterProgress,
        [selectedChapter.id]: {
          ...(current.chapterProgress?.[selectedChapter.id] || {}),
          [stepId]: value,
        },
      },
      lastUpdatedAt: new Date().toISOString(),
    }));
  };

  const handleAddMindBlocks = async () => {
    if (!user?.id) {
      toast.error("Faca login para salvar MindBlocks da jornada.");
      return;
    }
    setSaving(true);
    try {
      const payloads = selectedChapter.mindBlocks.map((mindBlock) => createChapterMindBlockPayload(selectedChapter, mindBlock));
      const created = [];
      for (const payload of payloads) {
        const item = await createMindBlock(payload, { userId: user.id, mode: "review" });
        created.push(item);
        recordLearningEvent("expression_saved", {
          expressionId: item.id,
          expression: item.expression,
          translation: item.translation,
          category: item.category,
          mastery: item.mastery,
        }, "learning_journey");
      }
      updateChapterStep("mindblocks");
      updateChapterStep("review");
      trackProgressionAction("saveMindBlock", { reason: "Learning Journey MindBlocks", category: selectedChapter.title });
      toast.success(`${created.length} MindBlocks adicionados a Biblioteca.`);
    } catch (error) {
      console.error("Erro ao salvar MindBlocks da jornada:", error);
      toast.error("Nao foi possivel salvar os MindBlocks agora.");
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteChapter = () => {
    const currentChecklist = getChapterChecklist(selectedChapter, journeyProgress);
    const minimumReady = currentChecklist.filter((item) => item.complete).length >= 4;
    if (!minimumReady) {
      toast.error("Conclua pelo menos 4 etapas do capitulo antes do desafio final.");
      return;
    }

    const nextChapter = learningJourneyChapters[selectedIndex + 1];
    setJourneyProgress((current) => {
      const completedChapterIds = [...new Set([...(current.completedChapterIds || []), selectedChapter.id])];
      return {
        ...current,
        completedChapterIds,
        activeChapterId: nextChapter?.id || selectedChapter.id,
        chapterProgress: {
          ...current.chapterProgress,
          [selectedChapter.id]: {
            ...(current.chapterProgress?.[selectedChapter.id] || {}),
            challenge: true,
            conversation: true,
          },
        },
        lastUpdatedAt: new Date().toISOString(),
      };
    });

    addXp(selectedChapter.xp, `${selectedChapter.title} chapter completed`);
    recordLearningEvent("learning_chapter_completed", {
      chapterId: selectedChapter.id,
      title: selectedChapter.title,
      xp: selectedChapter.xp,
      mindBlocks: selectedChapter.mindBlocks.length,
      nextChapterId: nextChapter?.id || null,
    }, "learning_journey");
    toast.success(nextChapter ? "Novo capítulo desbloqueado" : "Jornada concluída");
  };

  const neoUrl = `/chatbot?journey=${encodeURIComponent(selectedChapter.id)}&topic=${encodeURIComponent(selectedChapter.title)}&prompt=${encodeURIComponent(selectedChapter.neoPrompt)}`;

  return (
    <div className="min-h-screen bg-[var(--bg-main)] px-3 py-4 text-[var(--text-primary)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="fm-card overflow-hidden rounded-[34px] border p-5 shadow-2xl sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="fm-accent text-xs font-black uppercase tracking-[0.22em]">Jornada Guiada</p>
              <h1 className="mt-3 text-4xl font-black leading-tight sm:text-6xl">Seu caminho para pensar em inglês.</h1>
              <p className="fm-muted mt-4 max-w-2xl text-base leading-7 sm:text-lg">
                Continue de onde parou. O FluentMind escolhe o próximo passo, guia a lição e transforma cada capítulo em MindBlocks, revisão, XP e crescimento neural.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedChapterId(activeChapter.id)}
                  className="fm-primary-button inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-black"
                >
                  Continuar <ArrowRight className="h-4 w-4" />
                </button>
                <Link to={neoUrl} className="fm-ghost-button inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-black">
                  Praticar com Neo <MessageCircle className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <aside className="rounded-[30px] border border-[var(--border-soft)] bg-white/[0.04] p-5">
              <div className="flex items-center justify-between">
                <span className="fm-muted text-xs font-black uppercase tracking-[0.18em]">Progresso geral</span>
                <Route className="h-5 w-5 text-cyan-300" />
              </div>
              <strong className="mt-4 block text-5xl font-black">{overallProgress}%</strong>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-black/20 dark:bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-300" style={{ width: `${overallProgress}%` }} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <JourneyMetric label="Nível atual" value={progression.currentLevel} />
                <JourneyMetric label="XP da jornada" value={`${earnedJourneyXp}/${totalXp}`} />
              </div>
            </aside>
          </div>
        </section>

        <section className="fm-card rounded-[30px] border p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="fm-accent text-xs font-black uppercase tracking-[0.18em]">Roteiro</p>
              <h2 className="mt-1 text-2xl font-black">O próximo passo já está escolhido.</h2>
            </div>
            <span className="fm-chip hidden rounded-full px-4 py-2 text-sm font-bold sm:inline-flex">
              {completedSet.size}/{learningJourneyChapters.length} capítulos
            </span>
          </div>
          <div className="learning-roadmap grid gap-3 lg:grid-cols-10">
            {learningJourneyChapters.map((chapter, index) => {
              const complete = completedSet.has(chapter.id);
              const current = chapter.id === activeChapter.id;
              const unlocked = index <= activeIndex || complete;
              return (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => unlocked && setSelectedChapterId(chapter.id)}
                  className={`rounded-[24px] border p-4 text-left transition ${
                    chapter.id === selectedChapter.id
                      ? "border-cyan-400/60 bg-cyan-400/10"
                      : complete
                        ? "border-emerald-400/40 bg-emerald-400/10"
                        : current
                          ? "border-violet-400/50 bg-violet-400/10"
                          : unlocked
                            ? "border-[var(--border-soft)] bg-white/[0.03] hover:bg-white/[0.06]"
                            : "border-[var(--border-soft)] bg-slate-500/10 opacity-55"
                  }`}
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${
                    complete ? "bg-emerald-400/20 text-emerald-300" : current ? "bg-cyan-400/20 text-cyan-300" : "bg-white/10 text-[var(--text-muted)]"
                  }`}>
                    {complete ? <Check className="h-4 w-4" /> : unlocked ? chapter.order : <Lock className="h-4 w-4" />}
                  </span>
                  <strong className="mt-3 block text-sm">{chapter.title}</strong>
                  <small className="fm-muted mt-1 block">{chapter.difficulty}</small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <main className="fm-card rounded-[34px] border p-5 sm:p-8">
            {!isSelectedUnlocked ? (
              <LockedChapter chapter={selectedChapter} activeChapter={activeChapter} />
            ) : (
              <ChapterDetail
                chapter={selectedChapter}
                checklist={checklist}
                progressPercent={chapterProgressPercent}
                saving={saving}
                neoUrl={neoUrl}
                onStep={updateChapterStep}
                onAddMindBlocks={handleAddMindBlocks}
                onComplete={handleCompleteChapter}
                isComplete={completedSet.has(selectedChapter.id)}
              />
            )}
          </main>

          <aside className="space-y-5">
            <section className="fm-card rounded-[30px] border p-5">
              <p className="fm-muted text-xs font-black uppercase tracking-[0.18em]">Capítulo atual</p>
              <h2 className="mt-3 text-2xl font-black">{activeChapter.title}</h2>
              <p className="fm-muted mt-2 text-sm">{activeChapter.objective}</p>
              <div className="mt-5 space-y-3">
                <SideMetric icon={Target} label="Fluência estimada" value={`${Math.min(95, 12 + completedSet.size * 8)}%`} />
                <SideMetric icon={Zap} label="XP atual" value={progression.totalXp} />
                <SideMetric icon={Clock3} label="Meta semanal" value="3 passos de capítulo" />
              </div>
            </section>

            <section className="fm-card rounded-[30px] border p-5">
              <p className="fm-muted text-xs font-black uppercase tracking-[0.18em]">Recompensa do capítulo</p>
              <div className="mt-4 rounded-[26px] border border-violet-400/25 bg-violet-500/[0.08] p-5">
                <Trophy className="h-8 w-8 text-cyan-300" />
                <strong className="mt-4 block text-2xl font-black">+{selectedChapter.xp} XP</strong>
                <p className="fm-muted mt-2 text-sm">+{selectedChapter.mindBlocks.length} MindBlocks e novas conexões neurais.</p>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
}

function ChapterDetail({ chapter, checklist, progressPercent, saving, neoUrl, onStep, onAddMindBlocks, onComplete, isComplete }) {
  return (
    <div>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div>
          <p className="fm-accent text-xs font-black uppercase tracking-[0.18em]">Capítulo {chapter.order}</p>
          <h2 className="mt-2 text-4xl font-black leading-tight sm:text-5xl">{chapter.title}</h2>
          <p className="fm-muted mt-4 max-w-2xl text-lg leading-8">{chapter.intro}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="fm-chip rounded-full px-3 py-1 text-xs font-bold">{chapter.difficulty}</span>
            <span className="fm-chip rounded-full px-3 py-1 text-xs font-bold">{chapter.duration}</span>
            <span className="fm-chip rounded-full px-3 py-1 text-xs font-bold">+{chapter.xp} XP</span>
          </div>
        </div>
        <div className="min-w-[180px] rounded-[26px] border border-[var(--border-soft)] bg-white/[0.04] p-4">
          <span className="fm-muted text-xs font-black uppercase tracking-[0.16em]">Progresso do capítulo</span>
          <strong className="mt-2 block text-4xl font-black">{progressPercent}%</strong>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/20 dark:bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-300" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <LessonSection title="Vocabulário" icon={BookOpen} actionLabel="Marcar vocabulário concluído" onAction={() => onStep("vocabulary")}>
          <div className="flex flex-wrap gap-2">
            {chapter.vocabulary.map((word) => (
              <span key={word} className="rounded-full border border-[var(--border-soft)] bg-white/[0.04] px-3 py-2 text-sm font-bold">{word}</span>
            ))}
          </div>
        </LessonSection>

        <LessonSection title="MindBlocks" icon={Brain} actionLabel={saving ? "Salvando..." : "Adicionar à Biblioteca"} onAction={onAddMindBlocks}>
          <div className="space-y-3">
            {chapter.mindBlocks.slice(0, 5).map(([expression, translation]) => (
              <div key={expression} className="rounded-2xl border border-[var(--border-soft)] bg-white/[0.03] p-3">
                <strong className="block text-sm">{expression}</strong>
                <span className="fm-muted mt-1 block text-xs">{translation}</span>
              </div>
            ))}
          </div>
        </LessonSection>

        <LessonSection title="Escuta e fala" icon={Headphones} actionLabel="Marcar escuta concluída" onAction={() => {
          onStep("listening");
          onStep("review");
        }}>
          <p className="fm-muted text-sm leading-6">Ouça os MindBlocks do capítulo na Biblioteca, repita em voz alta e volte para marcar esta etapa.</p>
        </LessonSection>

        <LessonSection title="Conversa" icon={MessageCircle} actionLabel="Marcar conversa concluída" onAction={() => onStep("conversation")}>
          <p className="fm-muted text-sm leading-6">{chapter.neoPrompt}</p>
          <Link to={neoUrl} className="fm-primary-button mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-black">
            Praticar com Neo <ChevronRight className="h-4 w-4" />
          </Link>
        </LessonSection>
      </div>

      <section className="mt-6 rounded-[30px] border border-cyan-400/20 bg-cyan-400/[0.06] p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="fm-accent text-xs font-black uppercase tracking-[0.18em]">Desafio final</p>
            <h3 className="mt-2 text-2xl font-black">{chapter.finalChallenge}</h3>
            <p className="fm-muted mt-2 text-sm">Complete etapas suficientes e finalize o capítulo para desbloquear o próximo.</p>
          </div>
          <button type="button" onClick={onComplete} className="fm-primary-button inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-black">
            {isComplete ? "Concluído" : "Concluir capítulo"} <Sparkles className="h-4 w-4" />
          </button>
        </div>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {checklist.map((item) => (
          <div key={item.id} className={`rounded-2xl border p-3 text-sm ${item.complete ? "border-emerald-400/40 bg-emerald-400/10" : "border-[var(--border-soft)] bg-white/[0.03]"}`}>
            <span className="flex items-center gap-2 font-bold">
              {item.complete ? <Check className="h-4 w-4 text-emerald-300" /> : <Play className="h-4 w-4 text-[var(--text-muted)]" />}
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LessonSection({ title, icon: Icon, actionLabel, onAction, children }) {
  return (
    <section className="rounded-[30px] border border-[var(--border-soft)] bg-white/[0.035] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-black">
          {React.createElement(Icon, { className: "h-5 w-5 text-cyan-300" })}
          {title}
        </h3>
      </div>
      {children}
      <button type="button" onClick={onAction} className="fm-ghost-button mt-5 rounded-2xl px-4 py-2 text-sm font-black">
        {actionLabel}
      </button>
    </section>
  );
}

function LockedChapter({ chapter, activeChapter }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
      <Lock className="h-12 w-12 text-[var(--text-muted)]" />
      <h2 className="mt-5 text-3xl font-black">{chapter.title} is locked</h2>
      <p className="fm-muted mt-3 max-w-md">Complete the current chapter, {activeChapter.title}, to unlock this lesson.</p>
    </div>
  );
}

function JourneyMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-white/[0.04] p-3">
      <span className="fm-muted text-[11px] font-black uppercase tracking-[0.14em]">{label}</span>
      <strong className="mt-1 block text-lg font-black">{value}</strong>
    </div>
  );
}

function SideMetric({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-soft)] bg-white/[0.03] p-3">
      <span className="flex items-center gap-2 text-sm font-bold">
        {React.createElement(Icon, { className: "h-4 w-4 text-cyan-300" })}
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}
