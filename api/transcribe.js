/* eslint-env node */
import { OpenAI } from "openai";
import { requireUser } from "./_utils/auth.js";
import { consumeAiUsage, resolveAiPlan } from "./_utils/aiUsage.js";

function getOpenAiClient() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY || process.env.OPENAI_KEY;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function detectExtensionFromMime(mimeType) {
  const normalized = String(mimeType || "").toLowerCase().split(";")[0].trim();
  if (!normalized) return "";

  if (normalized.includes("webm")) return "webm";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("ogg") || normalized.includes("opus")) return "ogg";
  if (normalized.includes("mpeg") || normalized.includes("mpga") || normalized.includes("mp3")) return "mp3";
  if (
    normalized.includes("m4a") ||
    normalized.includes("mp4") ||
    normalized.includes("aac") ||
    normalized.includes("x-m4a") ||
    normalized.includes("3gpp")
  ) {
    return "m4a";
  }

  return "";
}

function detectExtensionFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return "";

  if (buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WAVE") {
    return "wav";
  }
  if (buffer.slice(0, 3).toString("ascii") === "ID3") {
    return "mp3";
  }
  if (buffer.slice(0, 4).toString("ascii") === "OggS") {
    return "ogg";
  }
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return "webm";
  }
  if (buffer.slice(4, 8).toString("ascii") === "ftyp") {
    return "m4a";
  }

  return "";
}

// ─── TTS via ElevenLabs ───────────────────────────────────────────────────

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const ELEVENLABS_MODEL   = "eleven_multilingual_v2";

const ELEVENLABS_VOICES = {
  female: process.env.ELEVENLABS_VOICE_FEMALE || "ucTM3xQVJcS7oeyyjEhT",
  male:   process.env.ELEVENLABS_VOICE_MALE   || "IKpiSijWzlhOL6uX83EH",
};

async function handleSpeak(req, res, user, openai) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const body   = parseBody(req);
  const text   = String(body.text || "").trim();
  const gender = body.voice === "male" ? "male" : "female";
  const voiceId = ELEVENLABS_VOICES[gender];

  if (!text) {
    return res.status(400).json({ error: "Texto não informado." });
  }
  if (text.length > 5000) {
    return res.status(400).json({ error: "Texto muito longo para síntese de voz." });
  }

  let base64;
  let mimeType = "audio/mpeg";

  if (apiKey) {
    const elevenRes = await fetch(`${ELEVENLABS_API_URL}/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key":   apiKey,
        "Content-Type": "application/json",
        "Accept":       "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        voice_settings: {
          stability:        0.5,
          similarity_boost: 0.80,
          style:            0.2,
          use_speaker_boost: true,
        },
      }),
    });

    if (!elevenRes.ok) {
      const errText = await elevenRes.text().catch(() => "");
      console.error("[elevenlabs]", elevenRes.status, errText);
      return res.status(502).json({ error: "Falha ao gerar áudio. Tente novamente." });
    }

    const arrayBuffer = await elevenRes.arrayBuffer();
    base64 = Buffer.from(arrayBuffer).toString("base64");
  } else {
    const speech = await openai.audio.speech.create({
      model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: gender === "male" ? "verse" : "alloy",
      input: text,
      format: "mp3",
    });

    const arrayBuffer = await speech.arrayBuffer();
    base64 = Buffer.from(arrayBuffer).toString("base64");
  }

  // Consumo simbólico
  const plan = await resolveAiPlan(user).catch(() => "pro");
  await consumeAiUsage({ userId: user.id, plan, deltas: { ai_chat: 1 } }).catch(() => {});

  return res.status(200).json({ audio: base64, mimeType });
}

// ─── STT (speech-to-text) — lógica original ───────────────────────────────

async function handleTranscribe(req, res, user, openai) {
  const body = parseBody(req);
  const { audio, mimeType } = body;

  if (!audio) {
    return res.status(400).json({ error: "Payload de áudio não recebido." });
  }

  const rawAudio = String(audio || "");
  const base64 = rawAudio.includes(",") ? rawAudio.slice(rawAudio.lastIndexOf(",") + 1) : rawAudio;
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length < 1000) {
    return res.status(400).json({
      error: "Áudio muito curto para transcrever. Grave por pelo menos 1 segundo.",
    });
  }

  const extension = detectExtensionFromMime(mimeType) || detectExtensionFromBuffer(buffer) || "webm";
  const file = await OpenAI.toFile(buffer, `fluentmind-audio.${extension}`);

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
    response_format: "json",
    temperature: 0.2,
  });

  const plan = await resolveAiPlan(user).catch(() => "pro");
  await consumeAiUsage({ userId: user.id, plan, deltas: { ai_chat: 1 } }).catch(() => {});

  return res.status(200).json({ text: transcription.text?.trim() ?? "" });
}

// ─── Handler principal ─────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não suportado." });
  }

  const openai = getOpenAiClient();

  if (!openai) {
    return res.status(500).json({
      error: "OPENAI_API_KEY não configurada.",
      details: "Configure OPENAI_API_KEY na Vercel. Também aceito CHATGPT_API_KEY ou OPENAI_KEY como fallback.",
    });
  }

  try {
    const user = await requireUser(req);
    const body = parseBody(req);
    const action = body.action ?? "transcribe";

    if (action === "speak") return await handleSpeak(req, res, user, openai);
    return await handleTranscribe(req, res, user, openai);
  } catch (error) {
    console.error("[transcribe]", error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      error: status < 500 ? error.message : "Não foi possível processar o áudio.",
    });
  }
}
