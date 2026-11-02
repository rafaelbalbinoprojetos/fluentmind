import { generateMindBlockAudio, getMindBlockAudio } from "./mindblockAudio.js";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Transcreve a gravação do aluno (rota existente /api/transcribe). */
export async function transcribeAudio(blob, accessToken, { signal } = {}) {
  if (!blob?.size || blob.size < 1200) throw new Error("Áudio muito curto. Fale por pelo menos 1 segundo.");
  const response = await fetch(`${API_BASE}/api/transcribe`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ action: "transcribe", audio: await blobToBase64(blob), mimeType: blob.type }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Erro ${response.status}`);
  return payload.text || "";
}

/** URL do áudio do MindBlock: reaproveita o que já foi gerado e só chama o ElevenLabs se faltar. */
export async function mindBlockAudioUrl({ mindblockId, voice, accessToken }) {
  const existing = await getMindBlockAudio({ mindblockId, voice, accessToken }).catch(() => null);
  if (existing?.signedUrl) return existing.signedUrl;
  const created = await generateMindBlockAudio({ mindblockId, voice, accessToken });
  return created?.signedUrl || null;
}

/** Palavras por minuto: medida simples de fluência da fala livre. */
export function wordsPerMinute(text, durationMs) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  if (!words || !durationMs) return 0;
  return Math.round(words / (durationMs / 60000));
}
