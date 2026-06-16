import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import {
  requestUltraAccessGrant,
  listUltraAccessPasses,
  revokeUltraAccessPass,
} from "../services/ultraAccess.js";
import { sanitizeEmailInput } from "../config/accessControl.js";
import { PLAN_LIST } from "../data/plans.js";

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value) {
  if (!value) return "—";
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return DATE_FORMATTER.format(date);
  } catch {
    return "—";
  }
}

export default function UltraAccessManager() {
  const { session, isMasterUser } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [formEmail, setFormEmail] = useState("");
  const [formPlan, setFormPlan] = useState("premium");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [revokingId, setRevokingId] = useState(null);
  const [lastGrantLink, setLastGrantLink] = useState("");

  const grantedTotal = items.filter((item) => !item.revoked_at && (item.status ?? "active") === "active").length;

  const normalizedFormEmail = useMemo(() => sanitizeEmailInput(formEmail), [formEmail]);

  const loadItems = useCallback(async () => {
    if (!isMasterUser) return;
    setLoading(true);
    try {
      const data = await listUltraAccessPasses();
      setItems(data);
      setFetchError(null);
    } catch (error) {
      console.error("[settings] Falha ao carregar acessos vitalícios:", error);
      setFetchError(
        error?.message ??
          "Não foi possível consultar a tabela ultra_access_grants. Execute a migração SQL no Supabase.",
      );
    } finally {
      setLoading(false);
    }
  }, [isMasterUser]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  if (!isMasterUser) {
    return null;
    }

  async function handleGrant(event, customEmail, customPlan, customExpiresAt) {
    event?.preventDefault?.();
    const targetEmail = sanitizeEmailInput(customEmail ?? normalizedFormEmail);
    if (!targetEmail) {
      toast.error("Informe um email válido.");
      return;
    }
    setSaving(true);
    try {
      const result = await requestUltraAccessGrant(targetEmail, {
        plan: customPlan ?? formPlan,
        expiresAt: customExpiresAt ?? formExpiresAt,
        accessToken: session?.access_token,
      });
      setLastGrantLink(result?.confirmUrl ?? "");
      if (result?.fallbackMode === "direct_supabase") {
        toast.success(`Acesso ativado diretamente para ${targetEmail} (modo local).`);
      } else {
        toast.success(`Convite criado para ${targetEmail}. Falta confirmação do usuário.`);
      }
      if (!customEmail) {
        setFormEmail("");
        setFormPlan("premium");
        setFormExpiresAt("");
      }
      loadItems();
    } catch (error) {
      console.error("[settings] Falha ao liberar acesso vitalício:", error);
      toast.error(error?.message ?? "Não foi possível liberar o acesso.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(item) {
    if (!item?.id) return;
    const confirmed = window.confirm(`Revogar acesso vitalício de ${item.email}?`);
    if (!confirmed) return;

    setRevokingId(item.id);
    try {
      await revokeUltraAccessPass({ id: item.id });
      toast.success(`Acesso de ${item.email} foi revogado.`);
      loadItems();
    } catch (error) {
      console.error("[settings] Falha ao revogar acesso vitalício:", error);
      toast.error(error?.message ?? "Não foi possível revogar o acesso.");
    } finally {
      setRevokingId(null);
    }
  }

  async function handleReactivate(item) {
    await handleGrant(null, item.email, item.plan ?? "premium", item.expires_at ?? "");
  }

  function handleCopyLink() {
    if (!lastGrantLink) return;
    navigator.clipboard
      .writeText(lastGrantLink)
      .then(() => toast.success("Link copiado."))
      .catch(() => toast.error("Não foi possível copiar o link."));
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Acesso Ultra (planos e prazo)</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Somente você vê esta seção. Libere planos com data de término ou acesso vitalício.
          </p>
        </div>

        <form onSubmit={handleGrant} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[1.2fr,0.8fr,0.6fr]">
            <input
              type="email"
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="email@exemplo.com"
              value={formEmail}
              onChange={(event) => setFormEmail(event.target.value)}
              disabled={saving}
              required
            />
            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={formPlan}
              onChange={(event) => setFormPlan(event.target.value)}
              disabled={saving}
            >
              {PLAN_LIST.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="rounded-xl border border-slate-300 px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={formExpiresAt}
              onChange={(event) => setFormExpiresAt(event.target.value)}
              disabled={saving}
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Deixe a data vazia para acesso vitalício. O término vale até 23:59 do dia informado.
            O convite será criado como pendente e só ativa após confirmação do usuário.
          </p>
          <button
            type="submit"
            disabled={saving || !normalizedFormEmail}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-600/60"
          >
            {saving ? "Salvando..." : "Liberar acesso"}
          </button>
        </form>

        {lastGrantLink && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
            <p className="font-semibold">Link de confirmação gerado</p>
            <p className="mt-1 break-all">{lastGrantLink}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="rounded-lg border border-emerald-300 px-3 py-1.5 font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
              >
                Copiar link
              </button>
              <a
                href={lastGrantLink}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-emerald-300 px-3 py-1.5 font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
              >
                Abrir confirmação
              </a>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
          {loading ? "Carregando lista..." : `${grantedTotal} email(s) com acesso vitalício ativo.`}
        </div>

        {fetchError ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {fetchError}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
            {items.length === 0 && !loading ? (
              <li className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Nenhum email liberado ainda.
              </li>
            ) : (
              items.map((item) => {
                const active = !item.revoked_at;
                return (
                  <li key={item.id} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.email}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {active ? "Ativo desde " : "Revogado em "}
                        {active ? formatDate(item.granted_at) : formatDate(item.revoked_at)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Status: {item.status ?? (active ? "active" : "revoked")}
                        {item.status === "pending" && item.confirmation_expires_at
                          ? ` • expira em ${formatDate(item.confirmation_expires_at)}`
                          : ""}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Plano: {item.plan ?? "premium"} • Término: {item.expires_at ? formatDate(item.expires_at) : "vitalício"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {active ? (
                        <button
                          type="button"
                          onClick={() => handleRevoke(item)}
                          disabled={revokingId === item.id}
                          className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                        >
                          {revokingId === item.id ? "Revogando..." : "Revogar"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReactivate(item)}
                          className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-600 transition hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                        >
                          Reativar
                        </button>
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
