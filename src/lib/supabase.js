import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const hasValidSupabaseCredentials = Boolean(
  supabaseUrl
    && supabaseAnonKey
    && isValidHttpUrl(supabaseUrl),
);

if (!hasValidSupabaseCredentials) {
  console.warn(
    "Supabase credentials are missing or invalid. Define VITE_SUPABASE_URL as a valid HTTP/HTTPS URL and VITE_SUPABASE_ANON_KEY in your environment.",
  );
}

export const supabaseConfigured = hasValidSupabaseCredentials;

export const supabase = hasValidSupabaseCredentials
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
