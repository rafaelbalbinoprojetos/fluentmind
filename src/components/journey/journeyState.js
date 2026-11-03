import { STATUS_LABELS } from "../../services/journeyEngine.js";

// Ícone e rótulo de estado. "Visto" (só leitura) nunca aparece igual a "Correto" ou "Demonstrado".
export function activityState(activity, currentId) {
  if (activity.id === currentId) return { key: "current", label: "Atual" };
  const status = activity.record?.status;
  if (activity.done && (status === "correct" || status === "demonstrated")) return { key: "approved", label: STATUS_LABELS[status] };
  if (activity.done && status === "viewed") return { key: "viewed", label: STATUS_LABELS.viewed };
  if (activity.done) return { key: "done", label: STATUS_LABELS[status] || "Feito" };
  if (status === "attempted") return { key: "attempted", label: "Tentado" };
  return { key: "pending", label: "A fazer" };
}
