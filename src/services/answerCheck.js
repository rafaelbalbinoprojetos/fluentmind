const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

const CONTRACTIONS = [
  [/\bwon't\b/g, "will not"],
  [/\bcan't\b/g, "can not"],
  [/\bcannot\b/g, "can not"],
  [/\bshan't\b/g, "shall not"],
  [/\b(\w+)n't\b/g, "$1 not"],
  [/\bi'm\b/g, "i am"],
  [/\b(you|we|they)'re\b/g, "$1 are"],
  [/\b(he|she|it|that|what|there|here|who)'s\b/g, "$1 is"],
  [/\b(\w+)'ll\b/g, "$1 will"],
  [/\b(\w+)'ve\b/g, "$1 have"],
  [/\b(\w+)'d\b/g, "$1 would"],
  [/\bgonna\b/g, "going to"],
  [/\bwanna\b/g, "want to"],
];

export function normalizeAnswer(value) {
  let text = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`´]/g, "'");
  for (const [pattern, replacement] of CONTRACTIONS) text = text.replace(pattern, replacement);
  return text.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Similaridade local 0-100 por palavras EM ORDEM (maior subsequência comum), equilibrando o que faltou e o que sobrou. */
export function localSimilarity(answer, expected) {
  const a = normalizeAnswer(answer).split(" ").filter(Boolean);
  const b = normalizeAnswer(expected).split(" ").filter(Boolean);
  if (!a.length || !b.length) return null;
  if (a.join(" ") === b.join(" ")) return 100;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const common = dp[a.length][b.length];
  const recall = common / b.length;
  const precision = common / a.length;
  return Math.round(((2 * recall * precision) / Math.max(0.0001, recall + precision)) * 100);
}

/** Correção pelo sentido via IA. mode: translate | fix | sentence. */
export async function checkAnswerWithAi({ mode, prompt, expected, answer, level, accessToken }) {
  const response = await fetch(`${API_BASE}/api/review-check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ mode, prompt, expected, answer, level }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Erro ${response.status}`);
  return payload;
}

/**
 * Alinha a fala transcrita com a frase esperada, palavra por palavra (shadowing).
 * Devolve as palavras da frase esperada com ok=true quando foram ditas (na ordem).
 */
export function wordDiff(spoken, expected) {
  const expectedWords = String(expected || "").split(/\s+/).filter(Boolean);
  const target = expectedWords.map((word) => normalizeAnswer(word));
  const said = normalizeAnswer(spoken).split(" ").filter(Boolean);
  // a forma expandida ("i am") vira várias palavras; compara pelo primeiro termo de cada palavra esperada
  const keys = target.map((word) => word.split(" ")[0] || "");
  const dp = Array.from({ length: keys.length + 1 }, () => new Array(said.length + 1).fill(0));
  for (let i = keys.length - 1; i >= 0; i -= 1) {
    for (let j = said.length - 1; j >= 0; j -= 1) {
      dp[i][j] = keys[i] && keys[i] === said[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const result = [];
  let i = 0;
  let j = 0;
  while (i < keys.length) {
    if (!keys[i]) {
      result.push({ word: expectedWords[i], ok: true });
      i += 1;
    } else if (j < said.length && keys[i] === said[j]) {
      result.push({ word: expectedWords[i], ok: true });
      i += 1;
      j += 1;
    } else if (j < said.length && dp[i][j + 1] >= dp[i + 1][j]) {
      j += 1;
    } else {
      result.push({ word: expectedWords[i], ok: false });
      i += 1;
    }
  }
  return result;
}
