import { createHash } from "node:crypto";

// Cache curto de avaliações, só para a MESMA tentativa no MESMO contexto (reenvio após falha de rede,
// clique duplo). A chave inclui usuário, tarefa, contexto e resposta inteiros: uma avaliação nunca é
// reaproveitada para outra pergunta, outra conversa ou outro aluno.
// Vive na memória da instância serverless: não persiste nem é compartilhado entre instâncias.

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 300;
const store = new Map();

export function evaluationKey(parts) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function getCachedEvaluation(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedEvaluation(key, value) {
  if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
  store.set(key, { at: Date.now(), value });
}

export function clearEvaluationCache() {
  store.clear();
}

/** Latência e tokens de uma chamada (quando o provedor informa), para acompanhar custo. */
export function usageMeta(completion, startedAt) {
  const usage = completion?.usage || {};
  return {
    ms: Date.now() - startedAt,
    promptTokens: Number(usage.prompt_tokens) || null,
    completionTokens: Number(usage.completion_tokens) || null,
  };
}
