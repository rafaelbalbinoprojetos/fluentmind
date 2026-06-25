import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertTriangle, Brain, Check, MessageCircle, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  deleteCorrectedMistake,
  listCorrectedMistakes,
  updateCorrectedMistake,
} from "../services/correctedMistakes.js";
import { createMindBlock } from "../services/mindblocks.js";
import { recordDailyActivity } from "../services/learningProgress.js";

function nextReviewDate(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export default function MistakesPage() {
  const { user } = useAuth();
  const [mistakes, setMistakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadMistakes() {
      if (!user?.id) {
        setMistakes([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await listCorrectedMistakes(user.id);
        if (!ignore) setMistakes(data);
      } catch (error) {
        console.error("Erro ao carregar erros corrigidos:", error);
        toast.error("Nao foi possivel carregar seus erros corrigidos.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadMistakes();
    return () => {
      ignore = true;
    };
  }, [user?.id]);

  const filteredMistakes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return mistakes;
    return mistakes.filter((item) => (
      item.originalText.toLowerCase().includes(normalized)
      || item.correctedText.toLowerCase().includes(normalized)
      || item.explanation.toLowerCase().includes(normalized)
      || item.category.toLowerCase().includes(normalized)
    ));
  }, [mistakes, query]);

  const stats = useMemo(() => ({
    total: mistakes.length,
    due: mistakes.filter((item) => item.isReviewDue || item.status === "review_due").length,
    mastered: mistakes.filter((item) => item.status === "mastered").length,
  }), [mistakes]);

  const saveAsMindBlock = async (mistake) => {
    if (!user?.id) return;
    try {
      setSavingId(mistake.id);
      await createMindBlock({
        expression: mistake.correctedText,
        translation: mistake.originalText,
        category: "Meus Erros",
        source: "Erro corrigido",
        notes: mistake.explanation || "Salvo a partir de um erro corrigido.",
        context: mistake.explanation,
        isFavorite: true,
        meta: {
          usage: mistake.explanation,
          examples: [mistake.correctedText],
          commonMistake: {
            wrong: mistake.originalText,
            correct: mistake.correctedText,
            explanation: mistake.explanation,
          },
          pattern: `${mistake.correctedText.split(" ").slice(0, 4).join(" ")} + context`,
          patternExplanation: "Revise a versão corrigida como um MindBlock completo.",
          personalNotes: mistake.explanation || "Salvo a partir de um erro corrigido.",
        },
      }, { userId: user.id, mode: "review" });
      await recordDailyActivity(user.id, {
        expressions_saved: 1,
        mindblocks_created: 1,
        study_minutes: 1,
      });
      toast.success("Erro salvo como MindBlock.");
    } catch (error) {
      console.error("Erro ao salvar erro como MindBlock:", error);
      toast.error(error.message || "Nao foi possivel salvar como MindBlock.");
    } finally {
      setSavingId(null);
    }
  };

  const markReviewed = async (mistake, result = "good") => {
    const nextMastery = result === "easy"
      ? Math.min(100, mistake.mastery + 16)
      : Math.min(100, mistake.mastery + 9);
    const status = nextMastery >= 90 ? "mastered" : "reviewed";
    const days = result === "easy" ? 14 : 5;

    try {
      setSavingId(mistake.id);
      const updated = await updateCorrectedMistake(mistake.id, {
        mastery: nextMastery,
        status,
        timesReviewed: mistake.timesReviewed + 1,
        lastReviewedAt: new Date().toISOString(),
        nextReviewAt: nextReviewDate(days),
      });
      setMistakes((current) => current.map((item) => (item.id === mistake.id ? updated : item)));
      await recordDailyActivity(user.id, {
        expressions_reviewed: 1,
        reviews_good: result === "good" ? 1 : 0,
        reviews_easy: result === "easy" ? 1 : 0,
        study_minutes: 1,
      });
      toast.success("Erro revisado.");
    } catch (error) {
      console.error("Erro ao revisar erro corrigido:", error);
      toast.error("Nao foi possivel atualizar este erro.");
    } finally {
      setSavingId(null);
    }
  };

  const removeMistake = async (mistake) => {
    try {
      setSavingId(mistake.id);
      await deleteCorrectedMistake(mistake.id);
      setMistakes((current) => current.filter((item) => item.id !== mistake.id));
      toast.success("Erro removido.");
    } catch (error) {
      console.error("Erro ao excluir erro corrigido:", error);
      toast.error("Nao foi possivel excluir este erro.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main className="space-y-6">
      <section className="fm-card rounded-[30px] border p-6 shadow-lg">
        <div className="grid gap-5 lg:grid-cols-[1fr,auto] lg:items-end">
          <div>
            <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Biblioteca de correções</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Meus Erros</h1>
            <p className="fm-muted mt-2 max-w-3xl text-sm">
              Transforme erros corrigidos pelo Neo em revisão ativa, MindBlocks e progresso pessoal.
            </p>
          </div>
          <Link to="/chatbot" className="fm-gradient inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold">
            <MessageCircle className="h-4 w-4" />
            Praticar com Neo
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <MistakeMetric label="Erros salvos" value={stats.total} />
          <MistakeMetric label="Para revisar" value={stats.due} />
          <MistakeMetric label="Dominados" value={stats.mastered} />
        </div>
      </section>

      <section className="fm-card rounded-[30px] border p-5 shadow-md">
        <label className="fm-input flex min-h-11 items-center gap-2 rounded-2xl border px-3">
          <Search className="fm-subtle h-4 w-4" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar erro, correcao ou explicacao..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>

        {loading ? (
          <div className="mt-5 grid gap-3">
            {[0, 1, 2].map((item) => <div key={item} className="fm-inner h-28 animate-pulse rounded-2xl border" />)}
          </div>
        ) : filteredMistakes.length === 0 ? (
          <div className="fm-inner mt-5 rounded-2xl border p-6 text-center">
            <Brain className="fm-secondary mx-auto h-10 w-10" />
            <h2 className="mt-3 text-lg font-semibold">Nenhum erro corrigido ainda.</h2>
            <p className="fm-muted mx-auto mt-2 max-w-md text-sm">
              Peça para o Neo corrigir uma frase em inglês. Quando houver correção, ela aparecerá aqui.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {filteredMistakes.map((mistake) => (
              <article key={mistake.id} className="fm-inner rounded-2xl border p-4">
                <div className="grid gap-4 lg:grid-cols-[1fr,auto] lg:items-start">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="library-badge danger">Erro</span>
                      <span className="library-badge">{mistake.level}</span>
                      <span className={`library-badge ${mistake.isReviewDue ? "warning" : "success"}`}>
                        {mistake.isReviewDue ? "Para revisar" : mistake.status}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-300">Original</p>
                        <p className="mt-2 text-sm font-semibold">{mistake.originalText}</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">Correto</p>
                        <p className="mt-2 text-sm font-semibold">{mistake.correctedText}</p>
                      </div>
                    </div>
                    {mistake.explanation ? <p className="fm-muted mt-3 text-sm">{mistake.explanation}</p> : null}
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <MistakeMetric label="Domínio" value={`${mistake.mastery}%`} compact />
                      <MistakeMetric label="Revisado" value={`${mistake.timesReviewed}x`} compact />
                      <MistakeMetric label="Próxima" value={mistake.nextReviewAt} compact />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:w-52 lg:grid-cols-1">
                    <button type="button" disabled={savingId === mistake.id} onClick={() => saveAsMindBlock(mistake)} className="library-panel-action">
                      <Plus className="h-4 w-4" /> Salvar MindBlock
                    </button>
                    <button type="button" disabled={savingId === mistake.id} onClick={() => markReviewed(mistake, "good")} className="library-panel-action">
                      <RotateCcw className="h-4 w-4" /> Revisado
                    </button>
                    <button type="button" disabled={savingId === mistake.id} onClick={() => markReviewed(mistake, "easy")} className="library-panel-action">
                      <Check className="h-4 w-4" /> Dominei fácil
                    </button>
                    <button type="button" disabled={savingId === mistake.id} onClick={() => removeMistake(mistake)} className="library-panel-action danger">
                      <Trash2 className="h-4 w-4" /> Excluir
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function MistakeMetric({ label, value, compact = false }) {
  return (
    <div className={`fm-inner rounded-2xl border ${compact ? "p-3" : "p-4"}`}>
      <p className="fm-subtle text-[0.68rem] font-semibold uppercase tracking-[0.14em]">{label}</p>
      <p className={`${compact ? "text-sm" : "text-2xl"} mt-1 font-bold`}>{value}</p>
    </div>
  );
}
