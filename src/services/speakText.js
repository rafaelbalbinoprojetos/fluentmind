// Leitura em voz alta pelo próprio navegador (Web Speech API): sem custo e sem chamada externa.
export function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
}

/** Lê várias falas em sequência (uma cena de diálogo). */
export function speakSequence(lines, { rate = 0.92 } = {}) {
  if (!canSpeak() || !lines?.length) return false;
  window.speechSynthesis.cancel();
  for (const line of lines) {
    const utterance = new window.SpeechSynthesisUtterance(line);
    utterance.lang = "en-US";
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  }
  return true;
}

export function speakText(text, { rate = 0.92 } = {}) {
  if (!canSpeak() || !text) return false;
  window.speechSynthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
  return true;
}
