/* eslint-env node */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabaseAuth = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null;

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
  if (!supabaseAuth) {
    const error = new Error("Supabase auth client not configured.");
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
