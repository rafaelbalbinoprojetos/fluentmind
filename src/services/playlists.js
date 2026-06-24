import { supabase, supabaseConfigured } from "../lib/supabase.js";

const PLAYLISTS_TABLE = "playlists";
const PLAYLIST_MIND_BLOCKS_TABLE = "playlist_mindblocks";

function ensureSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Supabase nao configurado.");
  }
}

export function mapPlaylistRow(row, count = 0) {
  return {
    id: row.id,
    name: row.name ?? "Untitled playlist",
    description: row.description ?? "",
    color: row.color ?? null,
    icon: row.icon ?? null,
    count,
    minutes: Math.max(3, Math.ceil(count * 0.75)),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export async function listPlaylists(userId) {
  ensureSupabase();
  if (!userId) return [];

  const [{ data: playlists, error: playlistsError }, { data: links, error: linksError }] = await Promise.all([
    supabase
      .from(PLAYLISTS_TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from(PLAYLIST_MIND_BLOCKS_TABLE)
      .select("playlist_id")
      .eq("user_id", userId),
  ]);

  if (playlistsError) throw playlistsError;
  if (linksError) throw linksError;

  const counts = new Map();
  (links ?? []).forEach((item) => {
    counts.set(item.playlist_id, (counts.get(item.playlist_id) ?? 0) + 1);
  });

  return (playlists ?? []).map((playlist) => mapPlaylistRow(playlist, counts.get(playlist.id) ?? 0));
}

export async function createPlaylist({ userId, name, description = "", color = null, icon = null }) {
  ensureSupabase();
  if (!userId) throw new Error("Usuario nao identificado.");
  if (!name?.trim()) throw new Error("Informe o nome da playlist.");

  const { data, error } = await supabase
    .from(PLAYLISTS_TABLE)
    .insert({
      user_id: userId,
      name: name.trim(),
      description: description?.trim() || null,
      color,
      icon,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapPlaylistRow(data, 0);
}

export async function updatePlaylist(id, patch = {}) {
  ensureSupabase();
  if (!id) throw new Error("Playlist nao identificada.");

  const next = {};
  if (patch.name !== undefined) {
    if (!patch.name?.trim()) throw new Error("Informe o nome da playlist.");
    next.name = patch.name.trim();
  }
  if (patch.description !== undefined) next.description = patch.description?.trim() || null;
  if (patch.color !== undefined) next.color = patch.color;
  if (patch.icon !== undefined) next.icon = patch.icon;

  if (Object.keys(next).length === 0) return null;

  const { data, error } = await supabase
    .from(PLAYLISTS_TABLE)
    .update(next)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapPlaylistRow(data, 0);
}

export async function deletePlaylist({ userId, playlistId }) {
  ensureSupabase();
  if (!userId || !playlistId) throw new Error("Playlist nao identificada.");

  const { error: linksError } = await supabase
    .from(PLAYLIST_MIND_BLOCKS_TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("playlist_id", playlistId);

  if (linksError) throw linksError;

  const { error } = await supabase
    .from(PLAYLISTS_TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("id", playlistId);

  if (error) throw error;
}

export async function addMindBlockToPlaylist({ userId, playlistId, mindBlockId }) {
  ensureSupabase();
  if (!userId || !playlistId || !mindBlockId) return null;

  const { data, error } = await supabase
    .from(PLAYLIST_MIND_BLOCKS_TABLE)
    .upsert(
      {
        user_id: userId,
        playlist_id: playlistId,
        mindblock_id: mindBlockId,
      },
      { onConflict: "playlist_id,mindblock_id" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function removeMindBlockFromPlaylist({ userId, playlistId, mindBlockId }) {
  ensureSupabase();
  if (!userId || !playlistId || !mindBlockId) return;

  const { error } = await supabase
    .from(PLAYLIST_MIND_BLOCKS_TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("playlist_id", playlistId)
    .eq("mindblock_id", mindBlockId);

  if (error) throw error;
}

export async function listPlaylistLinks(userId) {
  ensureSupabase();
  if (!userId) return [];

  const { data, error } = await supabase
    .from(PLAYLIST_MIND_BLOCKS_TABLE)
    .select("playlist_id,mindblock_id")
    .eq("user_id", userId);

  if (error) throw error;
  return data ?? [];
}
