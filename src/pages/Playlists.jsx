import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  BookOpen,
  Brain,
  Check,
  FolderPlus,
  Headphones,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { listMindBlocks } from "../services/mindblocks.js";
import {
  addMindBlockToPlaylist,
  createPlaylist,
  deletePlaylist,
  listPlaylistLinks,
  listPlaylists,
  removeMindBlockFromPlaylist,
  updatePlaylist,
} from "../services/playlists.js";
import { recordDailyActivity } from "../services/learningProgress.js";

const PLAYLIST_COLORS = ["violet", "cyan", "green", "orange", "rose"];

const starterPlaylists = [
  { name: "Daily Fluency", description: "Frases para conversar naturalmente todos os dias.", color: "violet", icon: "message" },
  { name: "Work English", description: "Reuniões, relatórios, atendimento e rotina profissional.", color: "cyan", icon: "work" },
  { name: "Travel", description: "Expressões para viagens, aeroportos, hotéis e restaurantes.", color: "orange", icon: "travel" },
  { name: "My Mistakes", description: "Correções que merecem revisão até ficarem naturais.", color: "rose", icon: "mistakes" },
];

function countLinks(links, playlistId) {
  return links.filter((link) => link.playlist_id === playlistId).length;
}

function minutesFromCount(count) {
  return Math.max(3, Math.ceil(count * 0.75));
}

function playlistTone(color) {
  if (color === "cyan") return "from-cyan-500/20 to-blue-500/10 text-cyan-200";
  if (color === "green") return "from-emerald-500/20 to-teal-500/10 text-emerald-200";
  if (color === "orange") return "from-orange-500/20 to-amber-500/10 text-orange-200";
  if (color === "rose") return "from-rose-500/20 to-pink-500/10 text-rose-200";
  return "from-violet-500/20 to-indigo-500/10 text-violet-200";
}

export default function PlaylistsPage() {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState([]);
  const [mindBlocks, setMindBlocks] = useState([]);
  const [links, setLinks] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    color: "violet",
  });

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [playlistRows, blockRows, linkRows] = await Promise.all([
          listPlaylists(user.id),
          listMindBlocks(user.id),
          listPlaylistLinks(user.id),
        ]);
        if (ignore) return;

        setPlaylists(playlistRows);
        setMindBlocks(blockRows);
        setLinks(linkRows);
        const selected = playlistRows[0] ?? null;
        setSelectedId(selected?.id ?? "");
        setForm({
          name: selected?.name ?? "",
          description: selected?.description ?? "",
          color: selected?.color ?? "violet",
        });
      } catch (error) {
        console.error("Erro ao carregar playlists:", error);
        toast.error("Nao foi possivel carregar suas playlists.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [user?.id]);

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedId) ?? null,
    [playlists, selectedId],
  );

  const selectedLinkIds = useMemo(
    () => new Set(links.filter((link) => link.playlist_id === selectedId).map((link) => link.mindblock_id)),
    [links, selectedId],
  );

  const playlistMindBlocks = useMemo(
    () => mindBlocks.filter((item) => selectedLinkIds.has(item.id)),
    [mindBlocks, selectedLinkIds],
  );

  const availableMindBlocks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return mindBlocks
      .filter((item) => !selectedLinkIds.has(item.id))
      .filter((item) => {
        if (!normalized) return true;
        return (
          item.expression.toLowerCase().includes(normalized)
          || item.translation.toLowerCase().includes(normalized)
          || item.category.toLowerCase().includes(normalized)
        );
      })
      .slice(0, 8);
  }, [mindBlocks, query, selectedLinkIds]);

  const stats = useMemo(() => ({
    playlists: playlists.length,
    linked: links.length,
    uncovered: mindBlocks.filter((item) => !links.some((link) => link.mindblock_id === item.id)).length,
  }), [links, mindBlocks, playlists.length]);

  const selectPlaylist = (playlist) => {
    setSelectedId(playlist.id);
    setForm({
      name: playlist.name,
      description: playlist.description,
      color: playlist.color || "violet",
    });
    setQuery("");
  };

  const createNewPlaylist = async (payload = null) => {
    if (!user?.id) return null;
    const source = payload ?? {
      name: "New Playlist",
      description: "A focused set of MindBlocks.",
      color: "violet",
      icon: "brain",
    };

    try {
      setSaving(true);
      const created = await createPlaylist({ userId: user.id, ...source });
      setPlaylists((current) => [created, ...current]);
      setSelectedId(created.id);
      setForm({
        name: created.name,
        description: created.description,
        color: created.color || "violet",
      });
      await recordDailyActivity(user.id, { playlists_created: 1, study_minutes: 1 });
      toast.success("Playlist criada.");
      return created;
    } catch (error) {
      console.error("Erro ao criar playlist:", error);
      toast.error(error.message || "Nao foi possivel criar a playlist.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const createStarterSet = async () => {
    if (!user?.id || saving) return;
    const existingNames = new Set(playlists.map((playlist) => playlist.name.trim().toLowerCase()));
    const missing = starterPlaylists.filter((item) => !existingNames.has(item.name.toLowerCase()));
    if (missing.length === 0) {
      toast("Suas playlists iniciais ja existem.");
      return;
    }

    try {
      setSaving(true);
      const created = [];
      for (const template of missing) {
        const playlist = await createPlaylist({ userId: user.id, ...template });
        created.push(playlist);
      }
      setPlaylists((current) => [...created, ...current]);
      if (created[0]) selectPlaylist(created[0]);
      await recordDailyActivity(user.id, { playlists_created: created.length, study_minutes: 1 });
      toast.success("Playlists iniciais criadas.");
    } catch (error) {
      console.error("Erro ao criar playlists iniciais:", error);
      toast.error("Nao foi possivel criar as playlists iniciais.");
    } finally {
      setSaving(false);
    }
  };

  const saveSelectedPlaylist = async () => {
    if (!selectedPlaylist || saving) return;

    try {
      setSaving(true);
      const updated = await updatePlaylist(selectedPlaylist.id, {
        name: form.name,
        description: form.description,
        color: form.color,
      });
      setPlaylists((current) => current.map((item) => (
        item.id === selectedPlaylist.id
          ? { ...item, ...updated, count: countLinks(links, item.id), minutes: minutesFromCount(countLinks(links, item.id)) }
          : item
      )));
      toast.success("Playlist atualizada.");
    } catch (error) {
      console.error("Erro ao atualizar playlist:", error);
      toast.error(error.message || "Nao foi possivel atualizar a playlist.");
    } finally {
      setSaving(false);
    }
  };

  const removeSelectedPlaylist = async () => {
    if (!user?.id || !selectedPlaylist || saving) return;
    const confirmed = window.confirm(`Excluir a playlist "${selectedPlaylist.name}"? Os MindBlocks serao mantidos na biblioteca.`);
    if (!confirmed) return;

    try {
      setSaving(true);
      await deletePlaylist({ userId: user.id, playlistId: selectedPlaylist.id });
      const nextPlaylists = playlists.filter((item) => item.id !== selectedPlaylist.id);
      setPlaylists(nextPlaylists);
      setLinks((current) => current.filter((link) => link.playlist_id !== selectedPlaylist.id));
      const nextSelected = nextPlaylists[0] ?? null;
      setSelectedId(nextSelected?.id ?? "");
      setForm({
        name: nextSelected?.name ?? "",
        description: nextSelected?.description ?? "",
        color: nextSelected?.color ?? "violet",
      });
      toast.success("Playlist excluida.");
    } catch (error) {
      console.error("Erro ao excluir playlist:", error);
      toast.error("Nao foi possivel excluir a playlist.");
    } finally {
      setSaving(false);
    }
  };

  const addToSelectedPlaylist = async (mindBlock) => {
    if (!user?.id || !selectedPlaylist || saving) return;

    try {
      setSaving(true);
      await addMindBlockToPlaylist({
        userId: user.id,
        playlistId: selectedPlaylist.id,
        mindBlockId: mindBlock.id,
      });
      setLinks((current) => [...current, {
        user_id: user.id,
        playlist_id: selectedPlaylist.id,
        mindblock_id: mindBlock.id,
      }]);
      setPlaylists((current) => current.map((item) => (
        item.id === selectedPlaylist.id
          ? { ...item, count: (item.count ?? 0) + 1, minutes: minutesFromCount((item.count ?? 0) + 1) }
          : item
      )));
      toast.success("MindBlock adicionado.");
    } catch (error) {
      console.error("Erro ao adicionar MindBlock:", error);
      toast.error("Nao foi possivel adicionar o MindBlock.");
    } finally {
      setSaving(false);
    }
  };

  const removeFromSelectedPlaylist = async (mindBlock) => {
    if (!user?.id || !selectedPlaylist || saving) return;

    try {
      setSaving(true);
      await removeMindBlockFromPlaylist({
        userId: user.id,
        playlistId: selectedPlaylist.id,
        mindBlockId: mindBlock.id,
      });
      setLinks((current) => current.filter((link) => !(
        link.playlist_id === selectedPlaylist.id && link.mindblock_id === mindBlock.id
      )));
      setPlaylists((current) => current.map((item) => (
        item.id === selectedPlaylist.id
          ? { ...item, count: Math.max(0, (item.count ?? 0) - 1), minutes: minutesFromCount(Math.max(0, (item.count ?? 0) - 1)) }
          : item
      )));
      toast.success("MindBlock removido.");
    } catch (error) {
      console.error("Erro ao remover MindBlock:", error);
      toast.error("Nao foi possivel remover o MindBlock.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl">
        <section className="fm-card rounded-[30px] border p-8 text-center shadow-lg">
          <Headphones className="fm-secondary mx-auto h-12 w-12 animate-pulse" />
          <h1 className="mt-4 text-3xl font-semibold">Playlists</h1>
          <p className="fm-muted mt-2">Carregando suas coleções de MindBlocks...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header className="fm-card overflow-hidden rounded-[32px] border p-6 shadow-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Playlists inteligentes</p>
            <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Organize seus MindBlocks por objetivo</h1>
            <p className="fm-muted mt-2 max-w-2xl text-sm">
              Agrupe frases por situação, tema ou rotina de estudo para praticar de forma mais direcionada.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <PlaylistMetric label="Playlists" value={stats.playlists} />
            <PlaylistMetric label="Vinculos" value={stats.linked} />
            <PlaylistMetric label="Sem playlist" value={stats.uncovered} />
          </div>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="fm-card rounded-[28px] border p-5 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="fm-subtle text-xs font-semibold uppercase tracking-[0.16em]">Coleções</p>
                <h2 className="mt-1 text-xl font-semibold">Suas playlists</h2>
              </div>
              <button type="button" className="library-mini-button" onClick={() => createNewPlaylist()} disabled={saving} aria-label="Criar playlist">
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {playlists.length === 0 ? (
                <p className="fm-muted rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                  Crie playlists para separar seus MindBlocks por temas como trabalho, viagem e erros recorrentes.
                </p>
              ) : playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  onClick={() => selectPlaylist(playlist)}
                  className={`rounded-3xl border p-4 text-left transition ${playlist.id === selectedId ? "border-violet-400/60 bg-violet-500/15" : "fm-inner hover:border-white/20"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{playlist.name}</h3>
                      <p className="fm-muted mt-1 line-clamp-2 text-xs">{playlist.description || "Playlist sem descrição."}</p>
                    </div>
                    <span className="library-badge">{playlist.count ?? countLinks(links, playlist.id)}</span>
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={createStarterSet}
              disabled={saving}
              className="library-ghost-button mt-4 w-full justify-center"
            >
              <FolderPlus className="h-4 w-4" />
              Criar playlists iniciais
            </button>
          </div>
        </aside>

        <section className="space-y-6">
          {selectedPlaylist ? (
            <>
              <article className={`rounded-[32px] border border-white/10 bg-gradient-to-br ${playlistTone(form.color)} p-6 shadow-lg`}>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                      <Headphones className="h-7 w-7" />
                    </div>
                    <h2 className="mt-5 text-3xl font-semibold text-white">{selectedPlaylist.name}</h2>
                    <p className="mt-2 text-sm text-slate-300">{selectedPlaylist.description || "Playlist pronta para receber MindBlocks."}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
                    <PlaylistMetric label="Itens" value={playlistMindBlocks.length} />
                    <PlaylistMetric label="Tempo" value={`${minutesFromCount(playlistMindBlocks.length)}m`} />
                    <PlaylistMetric label="Review" value={playlistMindBlocks.filter((item) => item.isReviewDue).length} />
                  </div>
                </div>
              </article>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <section className="fm-card rounded-[30px] border p-5 shadow-lg">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">MindBlocks</p>
                      <h3 className="mt-2 text-2xl font-semibold">Dentro desta playlist</h3>
                    </div>
                    <Link to="/insights" className="library-ghost-button">
                      <RotateCcw className="h-4 w-4" />
                      Revisar
                    </Link>
                  </div>

                  <div className="mt-5 grid gap-3">
                    {playlistMindBlocks.length === 0 ? (
                      <p className="fm-muted rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                        Esta playlist ainda está vazia. Adicione MindBlocks pela lista ao lado.
                      </p>
                    ) : playlistMindBlocks.map((mindBlock) => (
                      <MindBlockRow
                        key={mindBlock.id}
                        mindBlock={mindBlock}
                        actionLabel="Remover"
                        actionIcon={X}
                        onAction={() => removeFromSelectedPlaylist(mindBlock)}
                        disabled={saving}
                      />
                    ))}
                  </div>
                </section>

                <aside className="space-y-6">
                  <section className="fm-card rounded-[30px] border p-5 shadow-lg">
                    <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Editar</p>
                    <div className="mt-4 grid gap-3">
                      <label className="grid gap-1.5 text-sm font-semibold">
                        Nome
                        <input
                          className="fm-input rounded-2xl border px-4 py-3 text-sm"
                          value={form.name}
                          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-semibold">
                        Descrição
                        <textarea
                          className="fm-input min-h-24 rounded-2xl border px-4 py-3 text-sm"
                          value={form.description}
                          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                        />
                      </label>
                      <div>
                        <span className="text-sm font-semibold">Cor</span>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {PLAYLIST_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setForm((current) => ({ ...current, color }))}
                              className={`library-badge ${form.color === color ? "accent" : ""}`}
                            >
                              {color}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button type="button" className="fm-gradient rounded-2xl px-4 py-3 text-sm font-semibold text-white" onClick={saveSelectedPlaylist} disabled={saving}>
                          <Check className="mr-2 inline h-4 w-4" />
                          Salvar
                        </button>
                        <button type="button" className="library-ghost-button justify-center text-rose-200" onClick={removeSelectedPlaylist} disabled={saving}>
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="fm-card rounded-[30px] border p-5 shadow-lg">
                    <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Adicionar</p>
                    <label className="fm-input mt-4 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm">
                      <Search className="h-4 w-4 text-slate-400" />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar MindBlocks..."
                        className="w-full bg-transparent outline-none"
                      />
                    </label>
                    <div className="mt-4 grid gap-3">
                      {availableMindBlocks.length === 0 ? (
                        <p className="fm-muted rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                          Nenhum MindBlock disponível para adicionar.
                        </p>
                      ) : availableMindBlocks.map((mindBlock) => (
                        <MindBlockRow
                          key={mindBlock.id}
                          mindBlock={mindBlock}
                          compact
                          actionLabel="Adicionar"
                          actionIcon={Plus}
                          onAction={() => addToSelectedPlaylist(mindBlock)}
                          disabled={saving}
                        />
                      ))}
                    </div>
                  </section>
                </aside>
              </div>
            </>
          ) : (
            <section className="fm-card rounded-[30px] border p-8 text-center shadow-lg">
              <Brain className="fm-secondary mx-auto h-12 w-12" />
              <h2 className="mt-4 text-2xl font-semibold">Crie sua primeira playlist</h2>
              <p className="fm-muted mx-auto mt-2 max-w-xl text-sm">
                Playlists ajudam a transformar uma biblioteca crescente em trilhas de estudo simples e úteis.
              </p>
              <button type="button" className="fm-gradient mt-5 rounded-2xl px-5 py-3 text-sm font-semibold text-white" onClick={() => createNewPlaylist()} disabled={saving}>
                <FolderPlus className="mr-2 inline h-4 w-4" />
                Criar playlist
              </button>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}

function PlaylistMetric({ label, value }) {
  return (
    <div className="fm-inner rounded-2xl border px-4 py-3">
      <p className="fm-subtle text-[0.68rem] font-semibold uppercase tracking-[0.14em]">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function MindBlockRow({ mindBlock, actionLabel, actionIcon, onAction, disabled, compact = false }) {
  const ActionIcon = actionIcon;

  return (
    <article className={`fm-inner rounded-2xl border p-4 ${compact ? "" : "sm:flex sm:items-center sm:justify-between sm:gap-4"}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <BookOpen className="h-4 w-4 text-violet-200" />
          <h4 className="font-semibold">{mindBlock.expression}</h4>
        </div>
        <p className="fm-muted mt-1 text-sm">{mindBlock.translation || mindBlock.notes || "MindBlock sem tradução."}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="library-badge">{mindBlock.category}</span>
          <span className="library-badge">{mindBlock.mastery ?? 0}% mastery</span>
        </div>
      </div>
      <button type="button" onClick={onAction} disabled={disabled} className="library-ghost-button mt-3 sm:mt-0">
        <ActionIcon className="h-4 w-4" />
        {actionLabel}
      </button>
    </article>
  );
}
