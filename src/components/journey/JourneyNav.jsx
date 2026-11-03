import { useState } from "react";
import { Check, CircleDashed, Eye, Lock, Sparkles } from "lucide-react";
import { JOURNEY_PHASES } from "../../services/journeyEngine.js";
import { activityState } from "./journeyState.js";

function StateIcon({ state }) {
  if (state === "approved") return <Sparkles className="h-4 w-4" aria-hidden="true" />;
  if (state === "viewed") return <Eye className="h-4 w-4" aria-hidden="true" />;
  if (state === "done") return <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />;
  if (state === "locked") return <Lock className="h-4 w-4" aria-hidden="true" />;
  return <CircleDashed className="h-4 w-4" aria-hidden="true" />;
}

/**
 * Navegação em duas camadas:
 *  1. as 5 fases, com estado e progresso;
 *  2. as atividades da fase escolhida, com nome legível, estado e acesso direto.
 */
export default function JourneyNav({ activities, currentId, onGo }) {
  const currentPhase = activities.find((activity) => activity.id === currentId)?.phase || JOURNEY_PHASES[0].id;
  const [openPhase, setOpenPhase] = useState(currentPhase);
  // Ao avançar para outra fase, a camada 2 acompanha a atividade atual.
  const [trackedPhase, setTrackedPhase] = useState(currentPhase);
  if (trackedPhase !== currentPhase) {
    setTrackedPhase(currentPhase);
    setOpenPhase(currentPhase);
  }

  const shown = activities.filter((activity) => activity.phase === openPhase);

  return (
    <nav className="fm-jr-nav2" aria-label="Atividades do capítulo">
      <ol className="fm-jr-phase-tabs">
        {JOURNEY_PHASES.map((phase, index) => {
          const items = activities.filter((activity) => activity.phase === phase.id);
          const done = items.filter((activity) => activity.done).length;
          const complete = done === items.length;
          const isCurrent = phase.id === currentPhase;
          return (
            <li key={phase.id}>
              <button
                type="button"
                className={`fm-jr-phase-tab ${isCurrent ? "is-current" : ""} ${complete ? "is-complete" : ""} ${phase.id === openPhase ? "is-open" : ""}`}
                onClick={() => setOpenPhase(phase.id)}
                aria-expanded={phase.id === openPhase}
                aria-controls="journey-phase-activities"
                aria-current={isCurrent ? "step" : undefined}
              >
                <span className="fm-jr-phase-num" aria-hidden="true">{complete ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}</span>
                <span className="fm-jr-phase-text">
                  <span className="fm-jr-phase-name">{phase.label}</span>
                  <span className="fm-jr-phase-count">{done}/{items.length}<span className="sr-only"> atividades concluídas</span></span>
                </span>
                <span className="fm-jr-phase-meter" aria-hidden="true"><span style={{ width: `${(done / items.length) * 100}%` }} /></span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="fm-jr-phase-heading" aria-hidden="true">
        Fase {JOURNEY_PHASES.findIndex((phase) => phase.id === openPhase) + 1} · {JOURNEY_PHASES.find((phase) => phase.id === openPhase)?.label}
      </p>
      <ul id="journey-phase-activities" className="fm-jr-activity-list" aria-label={`Atividades de ${JOURNEY_PHASES.find((phase) => phase.id === openPhase)?.label}`}>
        {shown.map((activity) => {
          const state = activityState(activity, currentId);
          return (
            <li key={activity.id}>
              <button
                type="button"
                className={`fm-jr-activity is-${state.key}`}
                onClick={() => onGo(activity.id)}
                aria-current={activity.id === currentId ? "step" : undefined}
              >
                <span className="fm-jr-activity-icon"><StateIcon state={state.key} /></span>
                <span className="fm-jr-activity-title">{activity.title}</span>
                <span className="fm-jr-activity-state">{state.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
