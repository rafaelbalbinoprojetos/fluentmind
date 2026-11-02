// Public Supabase keys are allowed in Vite; administrator keys must stay on the server.
export function isServerSupabaseKey(value) {
  if (typeof value !== "string") return false;
  if (value.startsWith("sb_secret_")) return true;
  try {
    const payload = value.split(".")[1];
    if (!payload) return false;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized)).role === "service_role";
  } catch {
    return false;
  }
}
