import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import UltraAccessManager from "../components/UltraAccessManager.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { listUltraAccessPasses } from "../services/ultraAccess.js";

function isActiveGrant(record) {
  if (!record || record.revoked_at) return false;
  const status = String(record.status || "active").toLowerCase();
  if (status !== "active") return false;
  if (!record.expires_at) return true;
  const expiry = new Date(record.expires_at);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() > Date.now();
}

export default function UsersManagementPage() {
  const { subscription } = useAuth();
  const isMasterUser = Boolean(subscription?.isMasterUser);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [grants, setGrants] = useState([]);

  if (!isMasterUser) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    let ignore = false;

    async function loadStats() {
      setLoading(true);
      setError(null);
      try {
        const grantsData = await listUltraAccessPasses();
        if (ignore) return;
        setGrants(Array.isArray(grantsData) ? grantsData : []);
      } catch (loadError) {
        if (ignore) return;
        setError(loadError?.message || "Nao foi possivel carregar os indicadores.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadStats();
    return () => {
      ignore = true;
    };
  }, []);

  const stats = useMemo(() => {
    const activeGrants = grants.filter(isActiveGrant);
    const lifetimeGrants = activeGrants.filter((item) => !item.expires_at);
    const temporaryGrants = activeGrants.length - lifetimeGrants.length;

    return {
      activeAccessCount: activeGrants.length,
      lifetimeAccessCount: lifetimeGrants.length,
      temporaryAccessCount: temporaryGrants,
    };
  }, [grants]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Usuarios do FluentMind</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Painel administrativo para gerenciar acessos especiais e usuarios internos.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Acessos ativos
          </p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {loading ? "..." : stats.activeAccessCount}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Registros ativos de acesso Ultra.
          </p>
        </article>

        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Acessos vitalicios
          </p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {loading ? "..." : stats.lifetimeAccessCount}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Usuarios sem data de expiracao.
          </p>
        </article>

        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Acessos temporarios
          </p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {loading ? "..." : stats.temporaryAccessCount}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Convites ou liberacoes com expiracao.
          </p>
        </article>
      </section>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </p>
      )}

      <UltraAccessManager />
    </div>
  );
}
