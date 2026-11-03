import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Lock } from "lucide-react";

// Cabeçalho: capítulo, objetivo, progresso real e próxima ação. XP e currículo ficam discretos.
export function JourneyOverview({ chapter, goal, difficultyLabel, chaptersDone, totalChapters, activitiesDone, totalActivities, totalXp, nextAction, onNextAction, isCompleted = false }) {
  const percent = Math.round((activitiesDone / Math.max(1, totalActivities)) * 100);
  return (
    <header className="fm-jr-hero">
      <div className="fm-jr-hero-main">
        <p className="fm-jr-eyebrow">Capítulo {chapter.order} de {totalChapters} · {difficultyLabel}</p>
        <h1 className="fm-jr-title" aria-label={`Capítulo ${chapter.order}: ${chapter.title}`}>{chapter.title}</h1>
        <p className="fm-jr-goal">{goal}</p>
      </div>
      <div className="fm-jr-hero-side">
        <div className="fm-jr-ring" style={{ "--fm-ring": `${percent * 3.6}deg` }} role="img" aria-label={`${activitiesDone} de ${totalActivities} atividades do capítulo concluídas`}>
          <span><strong>{activitiesDone}</strong>/{totalActivities}</span>
        </div>
        <div className="min-w-0">
          {isCompleted ? (
            <p className="fm-jr-next-title"><Check className="h-4 w-4" aria-hidden="true" /> Capítulo concluído</p>
          ) : nextAction ? (
            <button type="button" className="fm-jr-next-action" onClick={onNextAction}>
              <span className="fm-jr-next-label">Próxima ação</span>
              <span className="fm-jr-next-title">{nextAction} <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
            </button>
          ) : (
            <p className="fm-jr-next-title">Tudo pronto para concluir</p>
          )}
          <p className="fm-jr-secondary-info">
            {chaptersDone} de {totalChapters} capítulos · {(totalXp || 0).toLocaleString("pt-BR")} XP de prática
          </p>
        </div>
      </div>
    </header>
  );
}

export function ChapterMap({ chapters, selectedId, activeId, completed, isUnlocked, onSelect }) {
  const scrollerRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const element = scrollerRef.current;
    if (!element) return;
    setEdges({
      left: element.scrollLeft > 4,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return undefined;
    element.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: "nearest", inline: "center" });
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [measure, selectedId]);

  const scrollBy = (direction) => {
    const element = scrollerRef.current;
    element?.scrollBy?.({ left: direction * element.clientWidth * 0.7, behavior: "smooth" });
  };

  // Setas do teclado movem entre os capítulos (padrão de lista horizontal).
  const onKeyDown = (event) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    const buttons = [...(scrollerRef.current?.querySelectorAll("button") || [])];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const target = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[target]?.focus();
    buttons[target]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };

  return (
    <nav aria-label="Capítulos da Jornada" className={`fm-jr-map ${edges.left ? "has-left" : ""} ${edges.right ? "has-right" : ""}`}>
      {edges.left ? (
        <button type="button" className="fm-jr-map-arrow is-left" onClick={() => scrollBy(-1)} aria-label="Ver capítulos anteriores" tabIndex={-1}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
      <ol ref={scrollerRef} onKeyDown={onKeyDown} onScroll={measure} className="fm-jr-map-track">
        {chapters.map((chapter) => {
          const done = completed.has(chapter.id);
          const unlocked = isUnlocked(chapter.id);
          const current = chapter.id === activeId && !done;
          const state = done ? "is-done" : current ? "is-current" : unlocked ? "is-open" : "is-locked";
          return (
            <li key={chapter.id}>
              <button
                type="button"
                className={`fm-jr-chapter ${state} ${chapter.id === selectedId ? "is-selected" : ""}`}
                onClick={() => unlocked && onSelect(chapter.id)}
                aria-disabled={!unlocked}
                aria-current={chapter.id === selectedId ? "page" : undefined}
                title={unlocked ? chapter.objective : "Conclua o capítulo atual para liberar este"}
              >
                <span className="fm-jr-chapter-dot" aria-hidden="true">
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : !unlocked ? <Lock className="h-3 w-3" /> : chapter.order}
                </span>
                <span className="fm-jr-chapter-name">{chapter.title}</span>
                <span className="sr-only">{done ? " (concluído)" : current ? " (atual)" : !unlocked ? " (bloqueado)" : ""}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {edges.right ? (
        <button type="button" className="fm-jr-map-arrow is-right" onClick={() => scrollBy(1)} aria-label="Ver próximos capítulos" tabIndex={-1}>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </nav>
  );
}
