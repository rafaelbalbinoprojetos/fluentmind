/* global process */
import { createClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";
import { requireUser } from "./_utils/auth.js";

const BUCKET = "mindblock-audio";
const TABLE = "mindblock_audio";
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const ELEVENLABS_MODEL = "eleven_multilingual_v2";

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey || !isValidHttpUrl(supabaseUrl)) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
}

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

function normalizeVoice(value) {
  const voice = String(value || "mineirinha").trim().toLowerCase();
  if (voice === "male") return "male";
  if (voice === "female") return "female";
  return "mineirinha";
}

function resolveVoiceId(voice) {
  if (voice === "male") return process.env.ELEVENLABS_VOICE_MALE || "IKpiSijWzlhOL6uX83EH";
  if (voice === "female") return process.env.ELEVENLABS_VOICE_FEMALE || "ucTM3xQVJcS7oeyyjEhT";
  return process.env.ELEVENLABS_VOICE_MINEIRINHA
    || process.env.ELEVENLABS_VOICE_ID
    || process.env.ELEVENLABS_VOICE_FEMALE
    || "ucTM3xQVJcS7oeyyjEhT";
}

function buildElevenLabsError(status) {
  if (status === 401 || status === 403) {
    return "ElevenLabs recusou a chave API. Confira se ELEVENLABS_API_KEY esta correta na Vercel.";
  }
  if (status === 400 || status === 404) {
    return "Voz do ElevenLabs invalida ou indisponivel. Configure ELEVENLABS_VOICE_MINEIRINHA com um voice_id da sua conta.";
  }
  if (status === 429) {
    return "Limite da ElevenLabs atingido. Tente novamente mais tarde.";
  }
  return "Falha ao gerar audio no ElevenLabs.";
}

function normalizeAudioText(value) {
  const replacements = {
    atividade: "playing soccer",
    atividades: "playing soccer",
    hobby: "playing guitar",
    hobbies: "playing guitar",
    comida: "pizza",
    comidas: "pizza",
    prato: "pizza",
    pratos: "pizza",
    nome: "John",
    pessoa: "John",
    cidade: "London",
    lugar: "the park",
    trabalho: "work",
    profissao: "teacher",
  };

  return String(value || "")
    .replace(/\[([^\]]+)\]/g, (match, rawKey) => {
      const key = String(rawKey || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return replacements[key] || match.replace(/[[\]]/g, "");
    })
    .replace(/\s+/g, " ")
    .trim();
}

async function createSignedAudioUrl(supabaseAdmin, storagePath) {
  const { data, error } = await supabaseAdmin
    .storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (error) throw error;
  return data?.signedUrl ?? null;
}

async function findExistingAudio(supabaseAdmin, userId, mindblockId, voice) {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("mindblock_id", mindblockId)
    .eq("voice", voice)
    .maybeSingle();

  if (error) throw error;
  if (!data?.storage_path) return null;

  const signedUrl = await createSignedAudioUrl(supabaseAdmin, data.storage_path);
  return { audio: data, signedUrl };
}

async function getMindBlock(supabaseAdmin, userId, mindblockId) {
  const { data, error } = await supabaseAdmin
    .from("mindblocks")
    .select("id, expression_en, meaning_pt")
    .eq("id", mindblockId)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
}

async function generateElevenLabsAudio({ text, voice }) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    const error = new Error("ELEVENLABS_API_KEY nao configurada.");
    error.statusCode = 500;
    throw error;
  }

  const voiceId = resolveVoiceId(voice);
  const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: ELEVENLABS_MODEL,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error("[mindblock-audio:elevenlabs]", response.status, details);
    const error = new Error(buildElevenLabsError(response.status));
    error.statusCode = 502;
    error.expose = true;
    throw error;
  }

  return Buffer.from(await response.arrayBuffer());
}

async function handleGet(req, res, user, supabaseAdmin) {
  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  const mindblockId = url.searchParams.get("mindblockId");
  const voice = normalizeVoice(url.searchParams.get("voice"));

  if (!mindblockId) {
    return res.status(400).json({ error: "mindblockId nao informado." });
  }

  const existing = await findExistingAudio(supabaseAdmin, user.id, mindblockId, voice);
  return res.status(200).json(existing ? { exists: true, ...existing } : { exists: false });
}

async function handlePost(req, res, user, supabaseAdmin) {
  const body = parseBody(req);
  const mindblockId = String(body.mindblockId || "").trim();
  const voice = normalizeVoice(body.voice);

  if (!mindblockId) {
    return res.status(400).json({ error: "mindblockId nao informado." });
  }

  const existing = await findExistingAudio(supabaseAdmin, user.id, mindblockId, voice);
  if (existing) {
    return res.status(200).json({ exists: true, created: false, ...existing });
  }

  const mindblock = await getMindBlock(supabaseAdmin, user.id, mindblockId);
  const text = normalizeAudioText(body.text || mindblock?.expression_en || "");

  if (!text) {
    return res.status(400).json({ error: "Texto do MindBlock nao encontrado." });
  }
  if (text.length > 500) {
    return res.status(400).json({ error: "Texto muito longo para audio de MindBlock." });
  }

  const audioBuffer = await generateElevenLabsAudio({ text, voice });
  const storagePath = `users/${user.id}/mindblocks/${mindblockId}/${voice}.mp3`;

  const { error: uploadError } = await supabaseAdmin
    .storage
    .from(BUCKET)
    .upload(storagePath, audioBuffer, {
      contentType: "audio/mpeg",
      cacheControl: "31536000",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const payload = {
    user_id: user.id,
    mindblock_id: mindblockId,
    storage_bucket: BUCKET,
    storage_path: storagePath,
    voice,
    provider: "elevenlabs",
    mime_type: "audio/mpeg",
    size_bytes: audioBuffer.length,
  };

  const { data, error: upsertError } = await supabaseAdmin
    .from(TABLE)
    .upsert(payload, { onConflict: "user_id,mindblock_id,voice" })
    .select("*")
    .single();

  if (upsertError) throw upsertError;

  const signedUrl = await createSignedAudioUrl(supabaseAdmin, storagePath);
  return res.status(201).json({ exists: true, created: true, audio: data, signedUrl });
}

export default async function handler(req, res) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(500).json({
      error: "Supabase nao configurado no servidor.",
      details: "Confira SUPABASE_URL e SUPABASE_SERVICE_KEY.",
    });
  }

  try {
    const user = await requireUser(req);

    if (req.method === "GET") return await handleGet(req, res, user, supabaseAdmin);
    if (req.method === "POST") return await handlePost(req, res, user, supabaseAdmin);

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Metodo nao suportado." });
  } catch (error) {
    console.error("[mindblock-audio]", error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      error: status < 500 || error.expose ? error.message : "Nao foi possivel processar o audio do MindBlock.",
    });
  }
}
