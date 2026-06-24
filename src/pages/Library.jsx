import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  Clock3,
  Filter,
  Flame,
  FolderPlus,
  Headphones,
  Heart,
  Import,
  Library,
  MessageCircle,
  MoreHorizontal,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  createMindBlock,
  deleteMindBlock,
  listMindBlocks,
  updateMindBlock,
} from "../services/mindblocks.js";
import { generateMindBlockAudio, getMindBlockAudio } from "../services/mindblockAudio.js";
import {
  addMindBlockToPlaylist,
  createPlaylist,
  listPlaylistLinks,
  listPlaylists,
  removeMindBlockFromPlaylist,
} from "../services/playlists.js";
import { recordDailyActivity } from "../services/learningProgress.js";
import { trackProgressionAction } from "../services/progressionEngine.js";
import { recordLearningEvent } from "../services/learningEventEngine.js";
import { normalizeMindBlockExpressionText } from "../utils/mindblockText.js";

const FILTERS = ["All", "Favorites", "Mastered", "Learning", "Review Due", "Mistakes", "Recently Saved"];
const STATUSES = ["All statuses", "new", "learning", "mastered", "review_due"];
const SORTS = ["Recently saved", "Most reviewed", "Highest mastery", "Lowest mastery", "A-Z"];
const CATEGORIES = [
  "All categories",
  "Daily Fluency",
  "Work",
  "Programming",
  "Feelings",
  "Questions",
  "Humor",
  "Grammar Pattern",
  "Pronunciation",
  "Listening",
  "Travel",
  "Gym",
  "Movies",
];

const collectionTemplates = [
  { id: "favorites", title: "Favorites", description: "Your most useful phrases.", icon: Star, tone: "favorite", filter: "Favorites" },
  { id: "recent", title: "Recently Saved", description: "Fresh MindBlocks from this week.", icon: Clock3, tone: "accent", filter: "Recently Saved" },
  { id: "review", title: "Review Due", description: "Ready to strengthen today.", icon: RotateCcw, tone: "warning", filter: "Review Due" },
  { id: "mastered", title: "Mastered", description: "Expressions becoming natural.", icon: Check, tone: "success", filter: "Mastered" },
  { id: "mistakes", title: "My Mistakes", description: "Turn errors into fluency.", icon: Zap, tone: "danger", filter: "Mistakes" },
  { id: "daily", title: "Daily Fluency", description: "Speak naturally every day.", icon: MessageCircle, tone: "accent", category: "Daily Fluency" },
  { id: "work", title: "Work English", description: "Meetings, shifts and reports.", icon: BookOpen, tone: "success", category: "Work" },
  { id: "travel", title: "Travel", description: "Move through the world.", icon: Sparkles, tone: "favorite", category: "Travel" },
  { id: "programming", title: "Programming", description: "Docs, SaaS and developer talk.", icon: Brain, tone: "accent", category: "Programming" },
  { id: "feelings", title: "Feelings", description: "Say what you feel clearly.", icon: Heart, tone: "danger", category: "Feelings" },
];

function normalizeStatus(status) {
  return status === "review_due" ? "Review Due" : status.charAt(0).toUpperCase() + status.slice(1);
}

function mockPronunciation(expression) {
  return `/${expression.toLowerCase().replace(/[^a-z' ]/g, "").split(" ").slice(0, 5).join(" ")}/`;
}

function masteryStrength(mastery) {
  if (mastery >= 86) return "Strong";
  if (mastery >= 68) return "Building";
  if (mastery >= 45) return "Fragile";
  return "New";
}

function inferPattern(expression) {
  if (expression.includes("getting used to")) return "I'm getting used to + noun / verb-ing";
  if (expression.includes("looking forward to")) return "I'm looking forward to + noun / verb-ing";
  if (expression.includes("How do you say")) return "How do you say + word + in English?";
  if (expression.includes("Let me")) return "Let me + base verb";
  return `${expression.split(" ").slice(0, 3).join(" ")} + context`;
}

function uniqueValues(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function isRecentlySaved(item) {
  if (!item.createdAt) return false;
  const createdAt = new Date(item.createdAt);
  if (Number.isNaN(createdAt.getTime())) return false;
  return Date.now() - createdAt.getTime() <= 7 * 24 * 60 * 60 * 1000;
}

function matchesCollection(item, template) {
  if (template.filter === "Favorites") return item.isFavorite;
  if (template.filter === "Recently Saved") return isRecentlySaved(item);
  if (template.filter === "Review Due") return item.isReviewDue || item.status === "review_due";
  if (template.filter === "Mastered") return item.status === "mastered";
  if (template.filter === "Mistakes") return Boolean(item.mistake || item.commonMistake);
  if (template.category) return item.category === template.category || item.category?.includes(template.category);
  return false;
}

function buildMindBlock(expression, expressions, playlists) {
  const sameCategory = expressions.filter((item) => item.id !== expression.id && item.category === expression.category);
  const relatedIds = expression.relatedExpressionIds?.length ? expression.relatedExpressionIds : sameCategory.slice(0, 4).map((item) => item.id);
  const relatedFromIds = relatedIds
    .map((id) => expressions.find((item) => item.id === id))
    .filter(Boolean);
  const relatedFromAi = (expression.relatedExpressions || []).map((item) => ({
    saved: expressions.find((savedItem) => (
      savedItem.id !== expression.id
      && savedItem.expression.trim().toLowerCase() === String(item.expression || "").trim().toLowerCase()
    )),
    item,
  })).map(({ saved, item }) => (saved || {
    id: `${expression.id}-${item.expression}`,
    expression: item.expression,
    translation: item.translation || "",
    isExternalSuggestion: true,
  }));
  const related = (relatedFromAi.length ? relatedFromAi : relatedFromIds).slice(0, 4);
  const variations = uniqueValues(expression.variations?.length ? expression.variations : []);

  return {
    ...expression,
    pronunciation: expression.pronunciation || mockPronunciation(expression.expression),
    strength: expression.strength || masteryStrength(expression.mastery),
    pattern: expression.pattern || inferPattern(expression.expression),
    patternExplanation: expression.patternExplanation || expression.practice || "Save the structure as a reusable mental block, then swap only the context.",
    variations,
    commonMistake: expression.commonMistake || expression.mistake || null,
    playlists: (expression.playlistIds || [])
      .map((playlistId) => playlists.find((item) => item.id === playlistId))
      .filter(Boolean),
    related,
  };
}

export default function LibraryPage() {
  const { user, session } = useAuth();
  const [expressions, setExpressions] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const audioRef = useRef(null);
  const [audioByMindBlock, setAudioByMindBlock] = useState({});
  const [audioLoadingId, setAudioLoadingId] = useState(null);
  const [selectedExpression, setSelectedExpression] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [category, setCategory] = useState("All categories");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [sort, setSort] = useState("Recently saved");

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 180);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let ignore = false;

    async function loadMindBlocks() {
      if (!user?.id) {
        setExpressions([]);
        setPlaylists([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(null);
      try {
        const [mindBlocksData, playlistsData, playlistLinks] = await Promise.all([
          listMindBlocks(user.id),
          listPlaylists(user.id),
          listPlaylistLinks(user.id),
        ]);
        if (ignore) return;
        const linksByMindBlock = new Map();
        playlistLinks.forEach((link) => {
          const current = linksByMindBlock.get(link.mindblock_id) ?? [];
          current.push(link.playlist_id);
          linksByMindBlock.set(link.mindblock_id, current);
        });
        setExpressions(mindBlocksData.map((item) => ({ ...item, playlistIds: linksByMindBlock.get(item.id) ?? [] })));
        setPlaylists(playlistsData);
      } catch (error) {
        console.error("Erro ao carregar MindBlocks:", error);
        if (ignore) return;
        setLoadError(error);
        setExpressions([]);
        setPlaylists([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadMindBlocks();

    return () => {
      ignore = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!selectedExpression) return;
    const latest = expressions.find((item) => item.id === selectedExpression.id);
    if (latest && latest !== selectedExpression) setSelectedExpression(latest);
  }, [expressions, selectedExpression]);

  const stats = useMemo(() => ({
    expressions: expressions.length,
    playlists: playlists.length,
    mastered: expressions.filter((item) => item.status === "mastered").length,
    dueToday: expressions.filter((item) => item.isReviewDue || item.status === "review_due").length,
    favorites: expressions.filter((item) => item.isFavorite).length,
  }), [expressions, playlists.length]);

  const filteredExpressions = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let result = expressions.filter((item) => {
      const matchesSearch = !query
        || item.expression.toLowerCase().includes(query)
        || item.translation.toLowerCase().includes(query)
        || item.category.toLowerCase().includes(query)
        || item.tags.some((tag) => tag.toLowerCase().includes(query));
      const matchesCategory = category === "All categories" || item.category.includes(category);
      const matchesPlaylist = !selectedPlaylistId || item.playlistIds?.includes(selectedPlaylistId);
      const matchesStatus = status === "All statuses" || item.status === status;
      const matchesFilter =
        activeFilter === "All"
        || (activeFilter === "Favorites" && item.isFavorite)
        || (activeFilter === "Mastered" && item.status === "mastered")
        || (activeFilter === "Learning" && item.status === "learning")
        || (activeFilter === "Review Due" && (item.isReviewDue || item.status === "review_due"))
        || (activeFilter === "Mistakes" && (item.mistake || item.commonMistake))
        || (activeFilter === "Recently Saved" && isRecentlySaved(item));
      return matchesSearch && matchesCategory && matchesPlaylist && matchesStatus && matchesFilter;
    });

    result = [...result].sort((a, b) => {
      if (sort === "Most reviewed") return b.timesReviewed - a.timesReviewed;
      if (sort === "Highest mastery") return b.mastery - a.mastery;
      if (sort === "Lowest mastery") return a.mastery - b.mastery;
      if (sort === "A-Z") return a.expression.localeCompare(b.expression);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return result;
  }, [activeFilter, category, debouncedSearch, expressions, selectedPlaylistId, sort, status]);

  const collections = useMemo(() => (
    collectionTemplates.map((template) => ({
      ...template,
      count: expressions.filter((item) => matchesCollection(item, template)).length,
    }))
  ), [expressions]);

  const selectCollection = (template) => {
    setSearch("");
    setStatus("All statuses");
    setSelectedPlaylistId("");
    if (template.category) {
      setActiveFilter("All");
      setCategory(template.category);
    } else {
      setCategory("All categories");
      setActiveFilter(template.filter || "All");
    }
  };

  const selectPlaylist = (playlistId) => {
    setSearch("");
    setActiveFilter("All");
    setCategory("All categories");
    setStatus("All statuses");
    setSelectedPlaylistId((current) => (current === playlistId ? "" : playlistId));
  };

  const updateExpression = async (id, patch) => {
    const previous = expressions;
    setExpressions((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

    try {
      const updated = await updateMindBlock(id, patch);
      if (updated) {
        setExpressions((current) => current.map((item) => (item.id === id ? { ...item, ...updated } : item)));
      }
    } catch (error) {
      console.error("Erro ao atualizar MindBlock:", error);
      setExpressions(previous);
      toast.error("Nao foi possivel atualizar este MindBlock.");
    }
  };

  const toggleFavorite = (expression) => {
    updateExpression(expression.id, { isFavorite: !expression.isFavorite });
    if (!expression.isFavorite) {
      recordLearningEvent("favorite_added", {
        expressionId: expression.id,
        expression: expression.expression,
        category: expression.category,
      }, "library");
      trackProgressionAction("addFavorite", { reason: "Favorite expression", category: expression.category });
    } else {
      recordLearningEvent("favorite_removed", {
        expressionId: expression.id,
        expression: expression.expression,
        category: expression.category,
      }, "library");
    }
    toast.success(expression.isFavorite ? "Removed from Favorites." : "Added to Favorites.");
  };

  const markMastered = (expression) => {
    updateExpression(expression.id, {
      status: "mastered",
      mastery: Math.max(expression.mastery, 90),
      isReviewDue: false,
      strength: "Strong",
      lastReviewedAt: "Today",
      nextReviewAt: "In 7 days",
    });
    recordLearningEvent("expression_mastered", {
      expressionId: expression.id,
      expression: expression.expression,
      category: expression.category,
      masteryBefore: expression.mastery,
      masteryAfter: 90,
    }, "library");
    trackProgressionAction("markMastered", { reason: "Expression mastered", category: expression.category });
    toast.success("Marked as mastered.");
  };

  const moveToReview = (expression) => {
    updateExpression(expression.id, { status: "review_due", isReviewDue: true, nextReviewAt: "Today" });
    toast.success("Moved to review.");
  };

  const deleteExpression = async (expression) => {
    const confirmed = window.confirm(`Delete "${expression.expression}"?`);
    if (!confirmed) return;
    const previous = expressions;
    setExpressions((current) => current.filter((item) => item.id !== expression.id));
    if (selectedExpression?.id === expression.id) setSelectedExpression(null);
    try {
      await deleteMindBlock(expression.id);
      toast.success("Expression deleted.");
    } catch (error) {
      console.error("Erro ao excluir MindBlock:", error);
      setExpressions(previous);
      toast.error("Nao foi possivel excluir este MindBlock.");
    }
  };

  const savePersonalNote = (expression, note) => {
    updateExpression(expression.id, { personalNotes: note, notes: note });
    toast.success("Personal note saved.");
  };

  const addExpressionToPlaylist = async (expression, playlistId) => {
    if (!user?.id || !expression?.id || !playlistId) return;
    if (expression.playlistIds?.includes(playlistId)) {
      toast("Este MindBlock ja esta nessa playlist.");
      return;
    }

    try {
      await addMindBlockToPlaylist({
        userId: user.id,
        playlistId,
        mindBlockId: expression.id,
      });
      setExpressions((current) => current.map((item) => (
        item.id === expression.id
          ? { ...item, playlistIds: [...(item.playlistIds || []), playlistId] }
          : item
      )));
      setPlaylists((current) => current.map((item) => (
        item.id === playlistId ? { ...item, count: (item.count ?? 0) + 1, minutes: Math.max(3, Math.ceil(((item.count ?? 0) + 1) * 0.75)) } : item
      )));
      recordLearningEvent("playlist_updated", {
        playlistId,
        name: playlists.find((item) => item.id === playlistId)?.name || "Playlist",
        expressionIds: [expression.id],
      }, "library");
      toast.success("MindBlock adicionado a playlist.");
    } catch (error) {
      console.error("Erro ao adicionar a playlist:", error);
      toast.error("Nao foi possivel adicionar a playlist.");
    }
  };

  const removeExpressionFromPlaylist = async (expression, playlistId) => {
    if (!user?.id || !expression?.id || !playlistId) return;

    try {
      await removeMindBlockFromPlaylist({
        userId: user.id,
        playlistId,
        mindBlockId: expression.id,
      });
      setExpressions((current) => current.map((item) => (
        item.id === expression.id
          ? { ...item, playlistIds: (item.playlistIds || []).filter((id) => id !== playlistId) }
          : item
      )));
      setPlaylists((current) => current.map((item) => (
        item.id === playlistId ? { ...item, count: Math.max(0, (item.count ?? 0) - 1), minutes: Math.max(3, Math.ceil(Math.max(0, (item.count ?? 0) - 1) * 0.75)) } : item
      )));
      if (selectedPlaylistId === playlistId) {
        setSelectedExpression(null);
      }
      toast.success("MindBlock removido da playlist.");
    } catch (error) {
      console.error("Erro ao remover da playlist:", error);
      toast.error("Nao foi possivel remover da playlist.");
    }
  };

  const playMindBlockAudio = async (expression) => {
    if (!expression?.id) return;
    if (!session?.access_token) {
      toast.error("Sessao expirada. Entre novamente para ouvir este MindBlock.");
      return;
    }

    const cached = audioByMindBlock[expression.id];
    const voice = user?.user_metadata?.assistant_voice || "mineirinha";

    try {
      setAudioLoadingId(expression.id);
      let audioData = cached;

      if (!audioData?.signedUrl) {
        audioData = await getMindBlockAudio({
          mindblockId: expression.id,
          voice,
          accessToken: session.access_token,
        });
      }

      if (!audioData?.signedUrl) {
        audioData = await generateMindBlockAudio({
          mindblockId: expression.id,
          voice,
          accessToken: session.access_token,
        });
        toast.success("Audio gerado e salvo no Supabase.");
      }
      trackProgressionAction("generateAudio", { reason: "Audio listened", category: expression.category });
      recordLearningEvent("audio_generated_mock", {
        expressionId: expression.id,
        expression: expression.expression,
        category: expression.category,
      }, "library");

      setAudioByMindBlock((current) => ({ ...current, [expression.id]: audioData }));

      if (audioRef.current) {
        audioRef.current.pause();
      }
      const nextAudio = new Audio(audioData.signedUrl);
      audioRef.current = nextAudio;
      await nextAudio.play();
    } catch (error) {
      console.error("Erro ao gerar/tocar audio do MindBlock:", error);
      toast.error(error.message || "Nao foi possivel tocar este audio.");
    } finally {
      setAudioLoadingId(null);
    }
  };

  const ensureDefaultPlaylist = async () => {
    if (playlists.length > 0) return playlists[0];
    const playlist = await createPlaylist({
      userId: user.id,
      name: "Daily Fluency",
      description: "Natural phrases for everyday answers.",
      color: "violet",
      icon: "message-circle",
    });
    setPlaylists((current) => [playlist, ...current]);
    recordLearningEvent("playlist_created", {
      playlistId: playlist.id,
      name: playlist.name,
      expressionIds: [],
    }, "library");
    return playlist;
  };

  const addExpression = async (payload, mode) => {
    if (!user?.id) {
      toast.error("Usuario nao identificado.");
      return;
    }

    try {
      const normalizedPayload = {
        ...payload,
        expression: normalizeMindBlockExpressionText(payload.expression),
      };
      const nextExpression = await createMindBlock(normalizedPayload, { userId: user.id, mode });
      let expressionWithPlaylist = nextExpression;
      let selectedPlaylistId = normalizedPayload.playlist;
      if (!selectedPlaylistId) {
        const defaultPlaylist = await ensureDefaultPlaylist();
        selectedPlaylistId = defaultPlaylist?.id;
      }
      if (selectedPlaylistId) {
        await addMindBlockToPlaylist({
          userId: user.id,
          playlistId: selectedPlaylistId,
          mindBlockId: nextExpression.id,
        });
        expressionWithPlaylist = { ...nextExpression, playlistIds: [selectedPlaylistId] };
        setPlaylists((current) => current.map((item) => (
          item.id === selectedPlaylistId ? { ...item, count: (item.count ?? 0) + 1 } : item
        )));
      }
      await recordDailyActivity(user.id, {
        expressions_saved: 1,
        mindblocks_created: 1,
        playlists_created: playlists.length === 0 && !payload.playlist ? 1 : 0,
        study_minutes: 1,
      });
      setExpressions((current) => [expressionWithPlaylist, ...current]);
      setAddModalOpen(false);
      recordLearningEvent("expression_saved", {
        expressionId: nextExpression.id,
        expression: expressionWithPlaylist.expression,
        translation: expressionWithPlaylist.translation,
        category: expressionWithPlaylist.category,
        playlistIds: expressionWithPlaylist.playlistIds || [],
        difficulty: expressionWithPlaylist.level,
        tags: expressionWithPlaylist.tags || [],
        mastery: expressionWithPlaylist.mastery,
        isFavorite: expressionWithPlaylist.isFavorite,
      }, "library");
      trackProgressionAction("saveMindBlock", { reason: "MindBlock saved", category: normalizedPayload.category });
      toast.success(mode === "review" ? "Expression saved and moved to review." : "Expression saved as a new MindBlock.");
    } catch (error) {
      console.error("Erro ao salvar MindBlock:", error);
      toast.error(error.message || "Nao foi possivel salvar a expressao.");
    }
  };

  return (
    <main className="space-y-6">
      <LibraryHeader search={search} onSearch={setSearch} onAdd={() => setAddModalOpen(true)} />
      <LibraryHeroCard stats={stats} />
      <QuickCollections collections={collections} activeFilter={activeFilter} category={category} onSelect={selectCollection} />
      <PlaylistsSection
        playlists={playlists}
        selectedPlaylistId={selectedPlaylistId}
        onCreateDefault={ensureDefaultPlaylist}
        onSelect={selectPlaylist}
      />

      <section className="fm-card rounded-[30px] border p-5 shadow-lg backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">All Expressions</p>
            <h2 className="mt-2 text-2xl font-semibold">
              {selectedPlaylistId ? playlists.find((item) => item.id === selectedPlaylistId)?.name || "Selected playlist" : "Your saved MindBlocks"}
            </h2>
            {selectedPlaylistId ? (
              <button type="button" onClick={() => setSelectedPlaylistId("")} className="fm-muted mt-2 text-sm font-semibold underline-offset-4 hover:underline">
                Clear playlist filter
              </button>
            ) : null}
          </div>
          <LibraryFilters
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            category={category}
            setCategory={setCategory}
            status={status}
            setStatus={setStatus}
            sort={sort}
            setSort={setSort}
          />
        </div>

        {loadError ? (
          <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
            Nao foi possivel carregar seus MindBlocks agora. Verifique a tabela `mindblocks` e as politicas RLS.
          </div>
        ) : loading ? (
          <LibraryLoadingState />
        ) : filteredExpressions.length === 0 ? (
          <EmptyLibraryState onAdd={() => setAddModalOpen(true)} />
        ) : (
          <div className="mt-5 grid gap-3">
            {filteredExpressions.map((expression, index) => (
              <ExpressionCard
                key={expression.id}
                expression={expression}
                index={index}
                onOpen={() => setSelectedExpression(expression)}
                onAudio={() => playMindBlockAudio(expression)}
                audioLoading={audioLoadingId === expression.id}
                hasAudio={Boolean(audioByMindBlock[expression.id]?.signedUrl)}
                onFavorite={() => toggleFavorite(expression)}
                onMastered={() => markMastered(expression)}
                onReview={() => moveToReview(expression)}
                onDelete={() => deleteExpression(expression)}
              />
            ))}
          </div>
        )}
      </section>

      {selectedExpression ? (
        <ExpressionDetailDrawer
          expression={selectedExpression}
          expressions={expressions}
          playlists={playlists}
          onClose={() => setSelectedExpression(null)}
          onFavorite={() => toggleFavorite(selectedExpression)}
          onMastered={() => markMastered(selectedExpression)}
          onReview={() => moveToReview(selectedExpression)}
          onDelete={() => deleteExpression(selectedExpression)}
          onAddToPlaylist={(playlistId) => addExpressionToPlaylist(selectedExpression, playlistId)}
          onRemoveFromPlaylist={(playlistId) => removeExpressionFromPlaylist(selectedExpression, playlistId)}
          onAudio={() => playMindBlockAudio(selectedExpression)}
          audioLoading={audioLoadingId === selectedExpression.id}
          hasAudio={Boolean(audioByMindBlock[selectedExpression.id]?.signedUrl)}
          onSaveNote={(note) => savePersonalNote(selectedExpression, note)}
          onOpenRelated={(nextExpression) => setSelectedExpression(nextExpression)}
        />
      ) : null}

      {addModalOpen ? (
        <AddExpressionModal
          playlists={playlists}
          onCreateDefaultPlaylist={ensureDefaultPlaylist}
          onClose={() => setAddModalOpen(false)}
          onSave={addExpression}
        />
      ) : null}
    </main>
  );
}

function LibraryHeader({ search, onSearch, onAdd }) {
  return (
    <header className="grid gap-4 lg:grid-cols-[1fr,auto] lg:items-end">
      <div>
        <div className="fm-chip inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          <Library className="h-3.5 w-3.5" />
          MindBlocks Library
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Minha Biblioteca</h1>
        <p className="fm-muted mt-2 max-w-3xl text-sm">
          Your personal collection of expressions, mistakes, playlists and MindBlocks.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr),auto,auto,auto]">
        <label className="fm-input flex min-h-11 items-center gap-2 rounded-2xl border px-3">
          <Search className="fm-subtle h-4 w-4" />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search expressions..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <button type="button" onClick={onAdd} className="fm-gradient inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-md transition hover:-translate-y-0.5">
          <Plus className="h-4 w-4" />
          Add Expression
        </button>
        <button type="button" className="library-ghost-button">
          <Import className="h-4 w-4" />
          Import
        </button>
        <button type="button" className="library-ghost-button">
          <RotateCcw className="h-4 w-4" />
          Review all
        </button>
      </div>
    </header>
  );
}

function LibraryHeroCard({ stats }) {
  const statItems = [
    { label: "expressions", value: stats.expressions },
    { label: "playlists", value: stats.playlists },
    { label: "mastered", value: stats.mastered },
    { label: "due today", value: stats.dueToday },
    { label: "favorites", value: stats.favorites },
  ];

  return (
    <section className="fm-gradient-soft relative overflow-hidden rounded-[30px] border p-6 shadow-lg">
      <div className="library-node-preview" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, index) => (
          <span key={index} style={{ "--i": index }} />
        ))}
      </div>
      <div className="relative z-10 grid gap-6 xl:grid-cols-[1fr,auto] xl:items-center">
        <div>
          <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Stop translating. Start thinking.</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Your English mind is growing.</h2>
          <p className="fm-muted mt-3 max-w-2xl text-sm leading-6">Every saved expression becomes a new MindBlock.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-5">
            {statItems.map((item) => (
              <div key={item.label} className="fm-inner rounded-2xl border p-4">
                <strong className="block text-2xl">{item.value}</strong>
                <span className="fm-subtle text-xs font-semibold uppercase tracking-[0.12em]">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="fm-gradient inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-md transition hover:-translate-y-0.5">
            <RotateCcw className="h-4 w-4" />
            Start Review
          </button>
          <Link to="/neural-universe" className="library-ghost-button">
            <Brain className="h-4 w-4" />
            Open Neural Universe
          </Link>
        </div>
      </div>
    </section>
  );
}

function QuickCollections({ collections, activeFilter, category, onSelect }) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Quick Collections</p>
          <h2 className="mt-2 text-2xl font-semibold">Choose a learning mood</h2>
        </div>
      </div>
      <div className="library-scroll-row">
        {collections.map((item) => (
          <CollectionCard
            key={item.id}
            item={item}
            active={item.category ? category === item.category : activeFilter === item.filter}
            onSelect={() => onSelect(item)}
          />
        ))}
      </div>
    </section>
  );
}

function CollectionCard({ item, active, onSelect }) {
  return (
    <button type="button" onClick={onSelect} className={`library-collection-card library-tone-${item.tone} ${active ? "is-active" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="library-card-icon"><item.icon className="h-5 w-5" /></span>
        <span className="fm-chip rounded-full border px-2 py-1 text-[11px] font-semibold">{item.count}</span>
      </div>
      <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
      <p className="fm-muted mt-1 text-sm">{item.description}</p>
      <div className="fm-progress-track mt-4 h-2 overflow-hidden rounded-full">
        <div className="fm-progress-fill h-full rounded-full" style={{ width: `${item.count > 0 ? Math.min(96, Math.max(12, item.count * 12)) : 0}%` }} />
      </div>
    </button>
  );
}

function PlaylistsSection({ playlists, selectedPlaylistId, onCreateDefault, onSelect }) {
  const visiblePlaylists = playlists.length > 0 ? playlists : [];

  return (
    <section className="fm-card rounded-[30px] border p-5 shadow-lg backdrop-blur-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Playlists</p>
          <h2 className="mt-2 text-2xl font-semibold">Organize expressions by situation, goal or emotion.</h2>
        </div>
        {visiblePlaylists.length === 0 ? (
          <button type="button" onClick={onCreateDefault} className="library-ghost-button">
            <FolderPlus className="h-4 w-4" />
            Create first playlist
          </button>
        ) : null}
      </div>
      {visiblePlaylists.length === 0 ? (
        <p className="fm-muted mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
          Create a playlist to group your MindBlocks by routine, work, travel or any learning goal.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {visiblePlaylists.map((playlist, index) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              index={index}
              active={playlist.id === selectedPlaylistId}
              onSelect={() => onSelect(playlist.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PlaylistCard({ playlist, index, active, onSelect }) {
  return (
    <article className={`library-playlist-card ${active ? "is-active" : ""}`} style={{ "--playlist-index": index }}>
      <button type="button" onClick={onSelect} className="block w-full text-left" aria-pressed={active}>
        <div className="library-playlist-cover">
          <Headphones className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-base font-semibold">{playlist.name}</h3>
        <p className="fm-subtle mt-1 text-xs">{playlist.description}</p>
        <div className="fm-muted mt-3 text-xs font-semibold">{playlist.count} expressions • {playlist.minutes} min</div>
      </button>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onSelect} className="library-mini-button" aria-label={`Open ${playlist.name}`}><Play className="h-3.5 w-3.5 fill-current" /></button>
        <button type="button" onClick={onSelect} className="library-mini-button" aria-label={`Review ${playlist.name}`}><RotateCcw className="h-3.5 w-3.5" /></button>
        <button type="button" className="library-mini-button" aria-label={`More ${playlist.name}`}><MoreHorizontal className="h-3.5 w-3.5" /></button>
      </div>
    </article>
  );
}

function LibraryFilters({ activeFilter, setActiveFilter, category, setCategory, status, setStatus, sort, setSort }) {
  return (
    <div className="grid gap-3 lg:min-w-[680px]">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((item) => (
          <button key={item} type="button" onClick={() => setActiveFilter(item)} className={`library-filter-chip ${activeFilter === item ? "is-active" : ""}`}>
            {item}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <SelectControl icon={Filter} value={category} onChange={setCategory} options={CATEGORIES} ariaLabel="Filter by category" />
        <SelectControl icon={Flame} value={status} onChange={setStatus} options={STATUSES} ariaLabel="Filter by status" />
        <SelectControl icon={ChevronDown} value={sort} onChange={setSort} options={SORTS} ariaLabel="Sort expressions" />
      </div>
    </div>
  );
}

function SelectControl({ icon, value, onChange, options, ariaLabel }) {
  const Icon = icon;
  return (
    <label className="fm-input flex min-h-11 items-center gap-2 rounded-2xl border px-3">
      <Icon className="fm-subtle h-4 w-4" />
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={ariaLabel} className="min-w-0 flex-1 bg-transparent text-sm outline-none">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function ExpressionCard({
  expression,
  index,
  onOpen,
  onAudio,
  audioLoading,
  hasAudio,
  onFavorite,
  onMastered,
  onReview,
  onDelete,
}) {
  return (
    <article className="library-expression-card" style={{ animationDelay: `${index * 35}ms` }}>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">🇺🇸 {expression.expression}</h3>
          <StatusBadge status={expression.status} />
          {expression.mistake ? <span className="library-badge danger">Correction</span> : null}
          {expression.isReviewDue ? <span className="library-badge warning">Due</span> : null}
        </div>
        <p className="fm-muted mt-1 text-sm">🇧🇷 {expression.translation}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="library-badge">{expression.category}</span>
          <span className="library-badge">{expression.difficulty}</span>
          <span className="library-badge">Next: {expression.nextReviewAt}</span>
        </div>
      </button>

      <div className="grid gap-3 sm:w-72">
        <div>
          <div className="fm-muted flex items-center justify-between text-xs font-semibold">
            <span>Mastery</span>
            <span>{expression.mastery}%</span>
          </div>
          <div className="fm-progress-track mt-2 h-2 overflow-hidden rounded-full">
            <div className="fm-progress-fill h-full rounded-full" style={{ width: `${expression.mastery}%` }} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onAudio}
            disabled={audioLoading}
            className={`library-action-button ${hasAudio ? "is-active" : ""}`}
            aria-label={hasAudio ? "Listen saved audio" : "Generate audio"}
            title={hasAudio ? "Listen saved audio" : "Generate audio"}
          >
            {audioLoading ? <Sparkles className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
          </button>
          <button type="button" className="library-action-button" aria-label="Practice"><MessageCircle className="h-4 w-4" /></button>
          <button type="button" onClick={onReview} className="library-action-button" aria-label="Review"><RotateCcw className="h-4 w-4" /></button>
          <button type="button" onClick={onFavorite} className={`library-action-button ${expression.isFavorite ? "is-favorite" : ""}`} aria-label="Favorite"><Star className="h-4 w-4" /></button>
          <button type="button" onClick={onMastered} className="library-action-button" aria-label="Mark as mastered"><Check className="h-4 w-4" /></button>
          <button type="button" onClick={onDelete} className="library-action-button danger" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }) {
  const tone = status === "mastered" ? "success" : status === "review_due" ? "warning" : status === "new" ? "accent" : "";
  return <span className={`library-badge ${tone}`}>{normalizeStatus(status)}</span>;
}

function ExpressionDetailDrawer({
  expression,
  expressions,
  playlists,
  onClose,
  onAudio,
  audioLoading,
  hasAudio,
  onFavorite,
  onMastered,
  onReview,
  onDelete,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onSaveNote,
  onOpenRelated,
}) {
  const block = useMemo(() => buildMindBlock(expression, expressions, playlists), [expression, expressions, playlists]);
  const [note, setNote] = useState(block.personalNotes || block.notes || "");

  useEffect(() => {
    setNote(block.personalNotes || block.notes || "");
  }, [block.id, block.notes, block.personalNotes]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const prepareNeo = () => {
    window.localStorage.setItem("fluentmind_neo_expression_context", JSON.stringify({
      expression: block.expression,
      translation: block.translation,
      category: block.category,
      source: "library-detail",
    }));
    toast.success("Practice with Neo is ready.");
  };

  return createPortal(
    <div className="library-drawer-wrap" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close drawer" />
      <aside className="library-drawer">
        <div className="mindblock-drawer-header">
          <div className="min-w-0">
            <div className="mindblock-badge-row">
              <span className="library-badge accent">MindBlock</span>
              <span className="library-badge">{block.category}</span>
              <span className="library-badge">{block.difficulty}</span>
              <StatusBadge status={block.status} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onFavorite}
              className={`mindblock-favorite-button ${block.isFavorite ? "is-favorite" : ""}`}
              aria-label="Favorite"
            >
              <Star className="h-4 w-4" />
            </button>
            <button type="button" onClick={onClose} className="library-close-button" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <section className="mindblock-main">
          <div className="mindblock-orb">
            <Brain className="h-8 w-8" />
          </div>
          <h2>{block.expression}</h2>
          <p>{block.translation}</p>
          <span>{block.pronunciation}</span>
        </section>

        <div className="mindblock-action-grid">
          <button type="button" className="library-panel-action" onClick={onAudio} disabled={audioLoading}>
            {audioLoading ? <Sparkles className="h-4 w-4 animate-spin" /> : <Headphones className="h-4 w-4" />}
            {audioLoading ? "Generating..." : hasAudio ? "Listen" : "Generate audio"}
          </button>
          <button type="button" className="library-panel-action" onClick={() => toast("Pronunciation practice coming soon.")}>
            <Zap className="h-4 w-4" /> Repeat
          </button>
          <Link to="/chatbot" onClick={prepareNeo} className="library-panel-action">
            <MessageCircle className="h-4 w-4" /> Practice with Neo
          </Link>
          <button type="button" onClick={onReview} className="library-panel-action">
            <RotateCcw className="h-4 w-4" /> Review now
          </button>
          <button type="button" onClick={onFavorite} className={`library-panel-action ${block.isFavorite ? "is-favorite" : ""}`}>
            <Star className="h-4 w-4" /> {block.isFavorite ? "Favorited" : "Favorite"}
          </button>
        </div>

        <section className="mindblock-mastery-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="fm-subtle text-xs font-semibold uppercase tracking-[0.12em]">Mastery</p>
              <h3>{block.mastery}%</h3>
              <p className="fm-muted text-sm">{block.strength} connection in your mental library.</p>
            </div>
            <Flame className="h-8 w-8 text-orange-300" />
          </div>
          <div className="fm-progress-track mt-4 h-3 overflow-hidden rounded-full">
            <div className="fm-progress-fill h-full rounded-full" style={{ width: `${block.mastery}%` }} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <PanelMetric label="Reviewed" value={`${block.timesReviewed}x`} />
            <PanelMetric label="Last" value={block.lastReviewedAt} />
            <PanelMetric label="Next" value={block.nextReviewAt} />
          </div>
        </section>

        <section className="mindblock-section">
          <h3>Natural Usage</h3>
          <p>{block.notes || "Use this expression in real conversation when it fits the context naturally."}</p>
          <h3 className="text-sm font-semibold">Examples</h3>
          <div className="mt-3 space-y-2">
            {(block.examples || []).map((example) => (
              <p key={example} className="mindblock-example">{example}</p>
            ))}
          </div>
        </section>

        <section className="mindblock-section">
          <h3>MindBlock Pattern</h3>
          <div className="mindblock-pattern">{block.pattern}</div>
          <p>{block.patternExplanation}</p>
          {block.variations.length ? (
            <div className="mt-3 grid gap-2">
              {block.variations.map((variation) => (
                <span key={variation} className="mindblock-example">{variation}</span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mindblock-section">
          <h3>Related Expressions</h3>
          <div className="mindblock-related-grid">
            {block.related.length ? block.related.map((related) => (
              <button
                key={related.id}
                type="button"
                className="mindblock-related-card"
                onClick={() => (related.isExternalSuggestion ? toast("Salve esta expressao pelo chat para abrir como MindBlock.") : onOpenRelated(related))}
              >
                <span>{related.expression}</span>
                <small>{related.translation}</small>
              </button>
            )) : <p>No related MindBlocks yet.</p>}
          </div>
        </section>

        {block.commonMistake ? (
          <section className="library-mistake-box">
            <h3 className="text-sm font-semibold">Common Mistake</h3>
            <p className="mt-2 text-sm text-rose-200">Wrong: {block.commonMistake.wrong}</p>
            <p className="mt-1 text-sm text-emerald-200">Correct: {block.commonMistake.correct}</p>
            <p className="fm-muted mt-2 text-sm">{block.commonMistake.explanation || "Notice the structure and repeat the correct version as one block."}</p>
          </section>
        ) : (
          <section className="mindblock-section">
            <h3>Common Mistake</h3>
            <p>No mistakes linked to this MindBlock yet.</p>
          </section>
        )}

        <section className="mindblock-section">
          <h3 className="text-sm font-semibold">Saved in playlists</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {block.playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                className="library-badge"
                onClick={() => onRemoveFromPlaylist(playlist.id)}
                title={`Remove from ${playlist.name}`}
              >
                {playlist.name}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
          <label className="fm-input mt-3 flex min-h-11 items-center gap-2 rounded-2xl border px-3">
            <FolderPlus className="fm-subtle h-4 w-4" />
            <select
              value=""
              onChange={(event) => {
                if (event.target.value) onAddToPlaylist(event.target.value);
              }}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              aria-label="Add MindBlock to playlist"
            >
              <option value="">Add to playlist...</option>
              {playlists
                .filter((playlist) => !block.playlists.some((saved) => saved.id === playlist.id))
                .map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}
            </select>
          </label>
        </section>

        <section className="mindblock-section">
          <h3>Personal Notes</h3>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} className="mindblock-notes" rows={4} />
          <button type="button" className="library-panel-action mt-3" onClick={() => onSaveNote(note)}>
            <Check className="h-4 w-4" /> Save note
          </button>
        </section>

        <section className="mindblock-neural-preview">
          <div className="mindblock-neural-line">
            <span>Core</span>
            <i />
            <span>{block.category}</span>
            <i />
            <span>Expression</span>
          </div>
          <p className="fm-muted mt-3 text-sm">This MindBlock is connected to your language universe through category, pattern and usage context.</p>
          <Link to="/neural-universe" className="library-panel-action mt-4">
            <Brain className="h-4 w-4" /> Open in Neural Universe
          </Link>
        </section>

        <div className="mindblock-footer-actions">
          <button type="button" onClick={onMastered} className="library-panel-action">
            <Check className="h-4 w-4" /> Mark as mastered
          </button>
          <button type="button" onClick={onReview} className="library-panel-action">
            <RotateCcw className="h-4 w-4" /> Move to review
          </button>
          <button type="button" onClick={onDelete} className="library-panel-action danger">
            <Trash2 className="h-4 w-4" /> Delete expression
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function PanelMetric({ label, value }) {
  return (
    <div className="fm-inner rounded-2xl border p-3">
      <p className="fm-subtle text-xs font-semibold uppercase tracking-[0.12em]">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function AddExpressionModal({ playlists, onCreateDefaultPlaylist, onClose, onSave }) {
  const [form, setForm] = useState({
    expression: "",
    translation: "",
    category: "Daily Fluency",
    playlist: playlists[0]?.id ?? "",
    difficulty: "A2",
    notes: "",
    tags: "",
    isFavorite: false,
  });

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    if (!form.playlist && playlists[0]?.id) {
      setForm((current) => ({ ...current, playlist: playlists[0].id }));
    }
  }, [form.playlist, playlists]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const submit = async (mode) => {
    if (!form.expression.trim() || !form.translation.trim()) {
      toast.error("Add the English expression and Portuguese translation.");
      return;
    }
    let payload = form;
    if (!payload.playlist && onCreateDefaultPlaylist) {
      try {
        const playlist = await onCreateDefaultPlaylist();
        payload = { ...payload, playlist: playlist?.id ?? "" };
      } catch (error) {
        console.error("Erro ao criar playlist padrao:", error);
        toast.error("Nao foi possivel criar a playlist padrao.");
        return;
      }
    }
    onSave(payload, mode);
  };

  return createPortal(
    <div className="library-modal-wrap" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close modal" />
      <section className="library-modal">
        <div className="library-modal-header">
          <div>
            <p className="fm-chip inline-flex rounded-full border px-3 py-1 text-xs font-semibold">New MindBlock</p>
            <h2 className="mt-4 text-2xl font-semibold">Add Expression</h2>
          </div>
          <button type="button" onClick={onClose} className="library-close-button" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="library-modal-body grid gap-3 sm:grid-cols-2">
          <Input label="English expression" value={form.expression} onChange={(value) => update("expression", value)} />
          <Input label="Portuguese translation" value={form.translation} onChange={(value) => update("translation", value)} />
          <Select label="Category" value={form.category} onChange={(value) => update("category", value)} options={CATEGORIES.filter((item) => item !== "All categories")} />
          <Select
            label="Playlist"
            value={form.playlist}
            onChange={(value) => update("playlist", value)}
            options={playlists.length > 0 ? playlists.map((item) => ({ label: item.name, value: item.id })) : [{ label: "Daily Fluency", value: "" }]}
          />
          <Select label="Difficulty" value={form.difficulty} onChange={(value) => update("difficulty", value)} options={["A1", "A2", "B1", "B2"]} />
          <Input label="Tags" value={form.tags} onChange={(value) => update("tags", value)} placeholder="work, routine, meeting" />
          <label className="sm:col-span-2">
            <span className="fm-subtle text-xs font-semibold uppercase tracking-[0.12em]">Notes</span>
            <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} rows={3} className="fm-input mt-2 w-full rounded-2xl border p-3 text-sm outline-none" />
          </label>
          <label className="fm-inner flex items-center gap-3 rounded-2xl border p-3">
            <input type="checkbox" checked={form.isFavorite} onChange={(event) => update("isFavorite", event.target.checked)} />
            <span className="text-sm font-semibold">Add to Favorites</span>
          </label>
        </div>
        <div className="library-modal-footer flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="library-ghost-button">Cancel</button>
          <button type="button" onClick={() => submit("review")} className="library-ghost-button">Save and review</button>
          <button type="button" onClick={() => submit("save")} className="fm-gradient inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-md">
            Save expression
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function Input({ label, value, onChange, placeholder }) {
  return (
    <label>
      <span className="fm-subtle text-xs font-semibold uppercase tracking-[0.12em]">{label}</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="fm-input mt-2 min-h-11 w-full rounded-2xl border px-3 text-sm outline-none" />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label>
      <span className="fm-subtle text-xs font-semibold uppercase tracking-[0.12em]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="fm-input mt-2 min-h-11 w-full rounded-2xl border px-3 text-sm outline-none">
        {options.map((option) => {
          const valueProp = typeof option === "string" ? option : option.value;
          const labelProp = typeof option === "string" ? option : option.label;
          return <option key={valueProp} value={valueProp}>{labelProp}</option>;
        })}
      </select>
    </label>
  );
}

function EmptyLibraryState({ onAdd }) {
  return (
    <div className="library-empty-state">
      <Brain className="fm-secondary mx-auto h-12 w-12" />
      <h3 className="mt-4 text-xl font-semibold">Your library is empty.</h3>
      <p className="fm-muted mx-auto mt-2 max-w-md text-sm">Start by saving your first real expression from a conversation with Neo.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link to="/chatbot" className="fm-gradient rounded-2xl px-4 py-3 text-sm font-semibold">Start Conversation</Link>
        <button type="button" onClick={onAdd} className="library-ghost-button">Add manually</button>
      </div>
    </div>
  );
}

function LibraryLoadingState() {
  return (
    <div className="mt-5 grid gap-3" aria-label="Loading MindBlocks">
      {[0, 1, 2].map((item) => (
        <div key={item} className="library-expression-card animate-pulse">
          <div className="h-5 w-2/5 rounded-full bg-white/10" />
          <div className="mt-3 h-4 w-1/3 rounded-full bg-white/10" />
          <div className="mt-5 h-2 w-full rounded-full bg-white/10" />
        </div>
      ))}
    </div>
  );
}
