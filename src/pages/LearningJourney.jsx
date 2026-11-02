import useLearningActions from "../hooks/useLearningActions.js";
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
  learningJourneyChapters,
} from "../data/learningJourney.js";
import { createMindBlock } from "../services/mindblocks.js";
import { checkAnswerWithAi } from "../services/answerCheck.js";

import { getProgressionState, updateProgressionState } from "../services/progressionEngine.js";

function loadJourneyProgress() {
  return { ...getInitialJourneyProgress(), ...getProgressionState()?.learningJourney };
}

function saveJourneyProgress(progress) {
  updateProgressionState((state) => ({ ...state, learningJourney: progress }));
  return progress;
}

// Frases reais do usuário nos diálogos: primeiro as do próprio MindBlock, depois as dos outros exemplos do capítulo.
function exampleSentencesFor(chapter, expression) {
  const examples = chapter.examples || [];
  const ownLines = (example) => (example.dialogue || []).filter((line) => line.speaker === "you").map((line) => line.en);
  const own = examples.filter((example) => example.expression === expression).flatMap(ownLines);
  const others = examples.filter((example) => example.expression !== expression).flatMap(ownLines);
  const sentences = [...own, ...others].slice(0, 2);
  return sentences.length ? sentences : [expression];
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
      examples: exampleSentencesFor(chapter, expression),
      pattern: `${expression.split(" ").slice(0, 3).join(" ")} + context`,
      patternExplanation: chapter.intro,
      commonMistake: chapter.commonMistakes?.[0] ? {
        wrong: chapter.commonMistakes[0].wrong,
        correct: chapter.commonMistakes[0].correct,
        explanation: chapter.commonMistakes[0].reason,
      } : null,
      relatedExpressions: chapter.mindBlocks.slice(0, 3).map(([itemExpression, itemTranslation]) => ({
        expression: itemExpression,
        translation: itemTranslation,
      })),
      practice: chapter.practiceDrills?.join("\n") || chapter.finalChallenge,
    },
  };
}

export default function LearningJourneyPage() {
  const { recordLearningEvent, trackProgressionAction, addXp } = useLearningActions();
  const { user } = useAuth();
  const progression = useProgression();
  const [journeyProgress, setJourneyProgress] = useState(loadJourneyProgress);
  const [selectedChapterId, setSelectedChapterId] = useState(() => loadJourneyProgress().activeChapterId);
  const [saving, setSaving] = useState(false);

  // Fonte única: cada alteração parte do estado salvo e grava na hora. Assim outras gravações
  // (XP, eventos) não carregam uma Jornada antiga e não sobrescrevem a marcação recém-feita.
  const updateJourney = (updater) => {
    const next = updater(loadJourneyProgress());
    saveJourneyProgress(next);
    setJourneyProgress(next);
  };

  // Só adota progresso vindo de fora (outra aba, Supabase, missão do Neo) quando ele for mais novo.
  useEffect(() => {
    if (!progression.learningJourney?.lastUpdatedAt) return;
    const remoteProgress = { ...getInitialJourneyProgress(), ...progression.learningJourney };
    const isNewer = !journeyProgress.lastUpdatedAt || new Date(remoteProgress.lastUpdatedAt) > new Date(journeyProgress.lastUpdatedAt);
    if (!isNewer) return;
    if (remoteProgress.activeChapterId !== journeyProgress.activeChapterId) {
      setSelectedChapterId(remoteProgress.activeChapterId || learningJourneyChapters[0].id);
    }
    setJourneyProgress(remoteProgress);
    // journeyProgress fica de fora de propósito: o efeito reage só a mudanças externas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progression.learningJourney, user?.id]);

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
    const alreadyComplete = Boolean(journeyProgress.chapterProgress?.[selectedChapter.id]?.[stepId]);
    updateJourney((current) => {
      return {
        ...current,
        chapterProgress: {
          ...current.chapterProgress,
          [selectedChapter.id]: {
            ...(current.chapterProgress?.[selectedChapter.id] || {}),
            [stepId]: value,
          },
        },
        lastUpdatedAt: new Date().toISOString(),
      };
    });

    if (value && !alreadyComplete) {
      addXp(2, `Etapa concluída: ${selectedChapter.title}`, { silent: true });
      recordLearningEvent("learning_journey_step_completed", {
        chapterId: selectedChapter.id,
        title: selectedChapter.title,
        stepId,
        xp: 2,
      }, "learning_journey");
    }
  };

  const handleAddMindBlocks = async () => {
    if (saving) return;
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
    if (completedSet.has(selectedChapter.id)) {
      toast("Capítulo já concluído.");
      return;
    }

    const currentChecklist = getChapterChecklist(selectedChapter, journeyProgress);
    const minimumReady = currentChecklist.filter((item) => item.complete).length >= 6;
    if (!minimumReady) {
      toast.error("Conclua pelo menos 6 etapas do capítulo antes do desafio final.");
      return;
    }

    const nextChapter = learningJourneyChapters[selectedIndex + 1];
    updateJourney((current) => {
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

  const neoUrl = `/neo?journey=${encodeURIComponent(selectedChapter.id)}`;

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
  const isDone = (stepId) => Boolean(checklist.find((item) => item.id === stepId)?.complete);
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
        <LessonSection done={isDone("lesson")} title="Aula principal" icon={BookOpen} actionLabel="Marcar aula concluída" onAction={() => onStep("lesson")}>
          <div className="space-y-4">
            <div className="rounded-[26px] border border-cyan-400/20 bg-cyan-400/[0.06] p-5">
              <p className="fm-accent text-xs font-black uppercase tracking-[0.16em]">{chapter.lessonTitle}</p>
              <div className="mt-4 space-y-3">
                {chapter.lesson.map((paragraph) => (
                  <p key={paragraph} className="fm-muted text-sm leading-7">{paragraph}</p>
                ))}
              </div>
            </div>
            <div className="rounded-[22px] border border-[var(--border-soft)] bg-white/[0.03] p-4">
              <strong className="block text-sm">Como estudar este capítulo</strong>
              <p className="fm-muted mt-2 text-sm leading-6">{chapter.studyTip}</p>
            </div>
          </div>
        </LessonSection>

        <LessonSection done={isDone("vocabulary")} title="Vocabulário" icon={BookOpen} actionLabel="Marcar vocabulário concluído" onAction={() => onStep("vocabulary")}>
          <div className="flex flex-wrap gap-2">
            {chapter.vocabulary.map((word) => (
              <span key={word} className="rounded-full border border-[var(--border-soft)] bg-white/[0.04] px-3 py-2 text-sm font-bold">{word}</span>
            ))}
          </div>
        </LessonSection>

        <LessonSection done={isDone("mindblocks")} title="MindBlocks" icon={Brain} actionLabel={saving ? "Salvando..." : "Adicionar à Biblioteca"} onAction={onAddMindBlocks}>
          <div className="space-y-3">
            {chapter.mindBlocks.slice(0, 5).map(([expression, translation]) => (
              <div key={expression} className="rounded-2xl border border-[var(--border-soft)] bg-white/[0.03] p-3">
                <strong className="block text-sm">{expression}</strong>
                <span className="fm-muted mt-1 block text-xs">{translation}</span>
              </div>
            ))}
          </div>
        </LessonSection>

        <LessonSection done={isDone("examples")} title="Exemplos reais" icon={MessageCircle} actionLabel="Marcar exemplos lidos" onAction={() => onStep("examples")}>
          <div className="space-y-3">
            {chapter.examples.map((example) => (
              <div key={example.expression} className="rounded-2xl border border-[var(--border-soft)] bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <strong className="text-sm">{example.expression}</strong>
                  <span className="fm-muted text-xs">{example.translation}</span>
                </div>
                {example.dialogue ? (
                  <>
                    <p className="fm-subtle mt-2 text-xs font-semibold uppercase tracking-[0.12em]">{example.situation}</p>
                    <div className="mt-3 space-y-2">
                      {example.dialogue.map((line) => (
                        <div key={line.en} className={`rounded-xl p-3 text-sm ${line.speaker === "you" ? "ml-6 border border-cyan-400/25 bg-cyan-400/[0.07]" : "mr-6 bg-black/10 dark:bg-white/[0.04]"}`}>
                          <span className="fm-subtle mb-1 block text-[10px] font-bold uppercase tracking-[0.14em]">{line.speaker === "you" ? "Você" : "Outra pessoa"}</span>
                          <span className="block">{highlightExpression(line.en, example.expression)}</span>
                          <span className="fm-muted mt-1 block text-xs">{line.pt}</span>
                        </div>
                      ))}
                    </div>
                    {example.note ? <p className="fm-subtle mt-3 text-xs leading-5">💡 {example.note}</p> : null}
                  </>
                ) : (
                  <p className="fm-subtle mt-3 text-xs leading-5">{example.context}</p>
                )}
              </div>
            ))}
          </div>
        </LessonSection>

        <LessonSection done={isDone("mistakes")} title="Erros comuns" icon={Zap} actionLabel="Marcar erros estudados" onAction={() => onStep("mistakes")}>
          <div className="space-y-3">
            {chapter.commonMistakes.map((mistake) => (
              <div key={mistake.wrong} className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.06] p-4">
                <p className="text-sm font-bold text-rose-300">Evite: {mistake.wrong}</p>
                <p className="mt-1 text-sm font-bold text-emerald-300">Use: {mistake.correct}</p>
                <p className="fm-muted mt-2 text-xs leading-5">{mistake.reason}</p>
              </div>
            ))}
          </div>
        </LessonSection>

        <LessonSection done={isDone("listening")} title="Escuta e fala" icon={Headphones} actionLabel="Marcar escuta concluída" onAction={() => {
          onStep("listening");
          onStep("review");
        }}>
          <p className="fm-muted text-sm leading-6">Ouça os MindBlocks do capítulo na Biblioteca, repita em voz alta e volte para marcar esta etapa.</p>
        </LessonSection>

        <LessonSection done={isDone("practice")} title="Exercícios rápidos" icon={Target} actionLabel="Marcar exercícios concluídos" onAction={() => onStep("practice")}>
          <div className="space-y-3">
            {chapter.practiceDrills.map((drill, index) => (
              <PracticeDrill key={drill} label={`Exercício ${index + 1}`} prompt={drill} chapter={chapter} onSaved={() => onStep("practice")} />
            ))}
            <PracticeDrill label="Mini quiz" prompt={chapter.miniQuiz.question} hint={chapter.miniQuiz.hint} chapter={chapter} onSaved={() => onStep("practice")} highlight />
          </div>
        </LessonSection>

        <LessonSection done={isDone("conversation")} title="Conversa" icon={MessageCircle} actionLabel="Marcar conversa concluída" onAction={() => onStep("conversation")}>
          <p className="fm-muted text-sm leading-6">
            Converse com o Neo e use 3 expressões deste capítulo com os seus próprios detalhes. Quando as 3 aparecerem, a conversa é marcada como concluída automaticamente.
          </p>
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

// Exercício com resposta: o usuário escreve, a IA corrige e a frase pessoal vira MindBlock para revisão.
function PracticeDrill({ label, prompt, hint, chapter, onSaved, highlight = false }) {
  const { user, session, userPreferences } = useAuth();
  const [answer, setAnswer] = useState("");
  const [meaning, setMeaning] = useState("");
  const [check, setCheck] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const finalSentence = (check?.corrected || answer).trim();

  const runCheck = async () => {
    if (!answer.trim() || checking) return;
    setChecking(true);
    try {
      setCheck(await checkAnswerWithAi({
        mode: "sentence",
        prompt,
        expected: chapter.mindBlocks.map(([expression]) => expression).slice(0, 5).join(" | "),
        answer,
        level: userPreferences?.currentLevel || "A2",
        accessToken: session?.access_token,
      }));
    } catch {
      setCheck({ verdict: "unchecked", feedback: "Correção da IA indisponível agora. Você ainda pode salvar a sua frase." });
    } finally {
      setChecking(false);
    }
  };

  const save = async () => {
    if (!user?.id) return toast.error("Faça login para salvar a frase.");
    if (!finalSentence || !meaning.trim() || saving) return;
    setSaving(true);
    try {
      await createMindBlock({
        expression: finalSentence,
        translation: meaning.trim(),
        category: `Journey: ${chapter.title}`,
        source: "Learning Journey",
        context: prompt,
        notes: `Frase pessoal criada no capítulo ${chapter.order}: ${chapter.title}.`,
        meta: { usage: chapter.objective, examples: [finalSentence] },
      }, { userId: user.id, mode: "review" });
      setSaved(true);
      onSaved?.();
      toast.success("Frase salva na Biblioteca e agendada para revisão.");
    } catch (error) {
      console.error("Erro ao salvar frase do exercício:", error);
      toast.error("Não foi possível salvar a frase agora.");
    } finally {
      setSaving(false);
    }
  };

  const tone = check?.verdict === "correct" ? "border-emerald-400/40 bg-emerald-400/10" : check?.verdict === "unchecked" ? "border-[var(--border-soft)]" : "border-amber-400/40 bg-amber-400/10";

  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-violet-400/20 bg-violet-500/[0.06]" : "border-[var(--border-soft)] bg-white/[0.03]"}`}>
      <span className="fm-chip inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black">{label}</span>
      <p className="fm-muted mt-3 text-sm leading-6">{prompt}</p>
      {hint ? <p className="fm-subtle mt-1 text-xs">{hint}</p> : null}
      {saved ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-emerald-300" role="status">
          <Check className="h-4 w-4" /> Salva: “{finalSentence}”
        </p>
      ) : (
        <>
          <textarea
            value={answer}
            onChange={(event) => { setAnswer(event.target.value); setCheck(null); }}
            rows={2}
            aria-label={`Resposta: ${label}`}
            placeholder="Escreva a sua frase em inglês..."
            className="mt-3 w-full resize-none rounded-2xl border border-[var(--border-soft)] bg-[var(--input-bg)] p-3 text-sm text-[var(--text-primary)] outline-none focus:border-cyan-300"
          />
          {!check ? (
            <button type="button" disabled={!answer.trim() || checking} onClick={runCheck} className="fm-primary-button mt-2 rounded-2xl px-4 py-2 text-sm font-black disabled:opacity-50">
              {checking ? "Corrigindo…" : "Corrigir"}
            </button>
          ) : (
            <div className={`mt-3 rounded-2xl border p-3 text-sm ${tone}`}>
              {check.feedback ? <p>{check.feedback}</p> : null}
              {check.corrected && check.corrected !== answer.trim() ? <p className="mt-1">Versão corrigida: <strong>{check.corrected}</strong></p> : null}
              {check.alternative ? <p className="fm-muted mt-1 text-xs">Outra forma natural: {check.alternative}</p> : null}
              <label className="mt-3 block text-xs font-bold">
                O que a sua frase significa em português?
                <input
                  value={meaning}
                  onChange={(event) => setMeaning(event.target.value)}
                  placeholder="Ex.: Eu acordo às 6 para ir à academia."
                  className="mt-1 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--input-bg)] p-2 text-sm font-normal text-[var(--text-primary)] outline-none focus:border-cyan-300"
                />
              </label>
              <button type="button" disabled={!meaning.trim() || saving} onClick={save} className="fm-primary-button mt-2 rounded-2xl px-4 py-2 text-sm font-black disabled:opacity-50">
                {saving ? "Salvando…" : "Salvar como MindBlock"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Destaca a frase do capítulo dentro da fala (ignora maiúsculas e a pontuação final).
function highlightExpression(text, expression) {
  const core = String(expression || "").replace(/[.!?]+$/, "").trim();
  const start = core ? text.toLowerCase().indexOf(core.toLowerCase()) : -1;
  if (start < 0) return text;
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded bg-cyan-400/20 px-0.5 font-semibold text-inherit">{text.slice(start, start + core.length)}</mark>
      {text.slice(start + core.length)}
    </>
  );
}

function LessonSection({ title, icon: Icon, actionLabel, onAction, done = false, children }) {
  return (
    <section className="rounded-[30px] border border-[var(--border-soft)] bg-white/[0.035] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-black">
          {React.createElement(Icon, { className: "h-5 w-5 text-cyan-300" })}
          {title}
        </h3>
      </div>
      {children}
      {done ? (
        <p className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-300" role="status">
          <Check className="h-4 w-4" /> Concluído
        </p>
      ) : (
        <button type="button" onClick={onAction} className="fm-ghost-button mt-5 rounded-2xl px-4 py-2 text-sm font-black">
          {actionLabel}
        </button>
      )}
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
