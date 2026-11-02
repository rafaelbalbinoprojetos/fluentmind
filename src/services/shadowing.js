import { mindBlockAudioUrl } from "./speech.js";

export const SHADOW_MAX_MS = 12000;

export function shadowVerdict(score) {
  if (score >= 90) return { label: "Clear and natural", tone: "good" };
  if (score >= 70) return { label: "Almost there", tone: "almost" };
  return { label: "Let's try again", tone: "wrong" };
}

/** Toca o modelo do card e resolve quando o som termina (para o microfone não captar o modelo). */
export async function playCardModel(card, { accessToken, voice, rate = 1, cache = {} } = {}) {
  let url = cache[card.id];
  if (!url && !card.isFallback && accessToken) {
    url = await mindBlockAudioUrl({ mindblockId: card.id, voice, accessToken });
    cache[card.id] = url;
  }
  if (url) {
    const audio = new Audio(url);
    audio.playbackRate = rate;
    const ended = new Promise((resolve) => {
      audio.onended = resolve;
      audio.onerror = resolve;
    });
    await audio.play();
    await ended;
  } else if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(card.expression);
    utterance.lang = "en-US";
    utterance.rate = rate;
    const ended = new Promise((resolve) => {
      utterance.onend = resolve;
      utterance.onerror = resolve;
    });
    window.speechSynthesis.speak(utterance);
    await ended;
  }
}
