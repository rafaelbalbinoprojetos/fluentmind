export const DEFAULT_CHAT_MODEL = "gpt-6-luna";

export function chatModelOptions({ correction = false, temperature = 0.7, maxTokens = 4096 } = {}) {
  const model = (correction && process.env.OPENAI_CORRECTION_MODEL)
    || process.env.OPENAI_MODEL || DEFAULT_CHAT_MODEL;
  return {
    model,
    max_completion_tokens: maxTokens,
    // GPT-5/6 reasoning requests do not accept sampling parameters.
    ...(/^gpt-[56](?:[.-]|$)/.test(model) ? { reasoning_effort: "low" } : { temperature }),
  };
}
