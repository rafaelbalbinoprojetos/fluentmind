/* eslint-env node */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getSupabaseAuthClient() {
  if (!supabaseUrl || !supabaseServiceKey || !isValidHttpUrl(supabaseUrl)) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
}

export function getAccessToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== "string") {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim();
}

export async function requireUser(req) {
  const supabaseAuth = getSupabaseAuthClient();

  if (!supabaseAuth) {
    const error = new Error(
      "Supabase auth client not configured. Check SUPABASE_URL and SUPABASE_SERVICE_KEY in Vercel. SUPABASE_URL must look like https://xxxxx.supabase.co without /rest/v1.",
    );
    error.statusCode = 500;
    throw error;
  }

  const token = getAccessToken(req);
  if (!token) {
    const error = new Error("Token de autenticação ausente.");
    error.statusCode = 401;
    throw error;
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data?.user) {
    const authError = new Error("Token inválido ou expirado.");
    authError.statusCode = 401;
    throw authError;
  }

  return data.user;
}
