import { Buffer } from "node:buffer";

export function resolveVoiceId(voice) {
  if (voice === "male") return process.env.ELEVENLABS_VOICE_MALE || "IKpiSijWzlhOL6uX83EH";
  if (voice === "female") return process.env.ELEVENLABS_VOICE_FEMALE || "ucTM3xQVJcS7oeyyjEhT";
  return process.env.ELEVENLABS_VOICE_MINEIRINHA || process.env.ELEVENLABS_VOICE_ID
    || process.env.ELEVENLABS_VOICE_FEMALE || "ucTM3xQVJcS7oeyyjEhT";
}

export function speechRequest(text, voice) {
  const model = process.env.ELEVENLABS_MODEL || "eleven_v4";
  const voiceId = resolveVoiceId(voice);
  if (model === "eleven_v4_turbo") {
    throw Object.assign(new Error("ELEVENLABS_MODEL eleven_v4_turbo requer WebSocket. Use eleven_v4 nesta integração."), { statusCode: 500 });
  }
  const dialogue = model === "eleven_v4";
  return {
    url: dialogue
      ? "https://api.elevenlabs.io/v1/text-to-dialogue?output_format=mp3_44100_128"
      : `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    body: dialogue
      ? { model_id: model, inputs: [{ text, voice_id: voiceId }] }
      : { model_id: model, text, voice_settings: { stability: 0.5 } },
  };
}

// Dialogue requests stay below the documented 2,000-character reliability limit.
export function speechChunks(text, limit = 1800) {
  const chunks = [];
  let remaining = text.trim();
  while (remaining.length > limit) {
    const prefix = remaining.slice(0, limit);
    const boundary = Math.max(prefix.lastIndexOf(". "), prefix.lastIndexOf("! "), prefix.lastIndexOf("? "), prefix.lastIndexOf("\n"));
    const space = prefix.lastIndexOf(" ");
    const split = boundary > limit / 2 ? boundary + 1 : space > limit / 2 ? space : limit;
    chunks.push(remaining.slice(0, split).trim());
    remaining = remaining.slice(split).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export async function generateElevenLabsAudio({ text, voice }) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw Object.assign(new Error("ELEVENLABS_API_KEY não configurada."), { statusCode: 500 });
  const buffers = [];
  for (const chunk of speechChunks(text)) {
    const request = speechRequest(chunk, voice);
    const response = await fetch(request.url, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) {
      console.error("[elevenlabs] Speech request failed:", response.status);
      throw Object.assign(new Error("Não foi possível gerar o áudio agora. Tente novamente mais tarde."), { statusCode: 502 });
    }
    buffers.push(Buffer.from(await response.arrayBuffer()));
  }
  return Buffer.concat(buffers);
}
