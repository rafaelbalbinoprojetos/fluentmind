/* eslint-env node */

function maskPresence(value) {
  if (!value) return { present: false };
  const raw = String(value);
  return {
    present: true,
    length: raw.length,
    startsWith: raw.slice(0, 8),
  };
}

export default function handler(_req, res) {
  return res.status(200).json({
    ok: true,
    env: {
      OPENAI_API_KEY: maskPresence(process.env.OPENAI_API_KEY),
      CHATGPT_API_KEY: maskPresence(process.env.CHATGPT_API_KEY),
      OPENAI_KEY: maskPresence(process.env.OPENAI_KEY),
      SUPABASE_URL: maskPresence(process.env.SUPABASE_URL),
      SUPABASE_SERVICE_KEY: maskPresence(process.env.SUPABASE_SERVICE_KEY),
      VITE_SUPABASE_URL: maskPresence(process.env.VITE_SUPABASE_URL),
      VITE_SUPABASE_ANON_KEY: maskPresence(process.env.VITE_SUPABASE_ANON_KEY),
      ELEVENLABS_API_KEY: maskPresence(process.env.ELEVENLABS_API_KEY),
    },
  });
}
