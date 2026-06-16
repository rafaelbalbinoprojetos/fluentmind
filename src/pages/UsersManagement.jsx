import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import UltraAccessManager from "../components/UltraAccessManager.jsx";
import SubscriptionPaymentsPanel from "../components/SubscriptionPaymentsPanel.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { listUltraAccessPasses } from "../services/ultraAccess.js";
import { listMercadoPagoPayments } from "../services/mercadoPagoPayments.js";
import { formatCurrency } from "../utils/formatters.js";

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
  const [payments, setPayments] = useState([]);

  if (!isMasterUser) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    let ignore = false;

    async function loadStats() {
      setLoading(true);
      setError(null);
      try {
        const [grantsData, paymentsData] = await Promise.all([
          listUltraAccessPasses(),
          listMercadoPagoPayments({ limit: 200 }),
        ]);

        if (ignore) return;
        setGrants(Array.isArray(grantsData) ? grantsData : []);
        setPayments(Array.isArray(paymentsData) ? paymentsData : []);
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
    const approvedPayments = payments.filter((item) => String(item?.status || "").toLowerCase() === "approved");
    const totalRevenue = approvedPayments.reduce((sum, item) => {
      const amount = Number(item?.amount ?? 0);
      return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);

    const subscribersPaid = new Set();
    approvedPayments.forEach((item) => {
      const key = String(item?.user_id || item?.payer_email || "").trim().toLowerCase();
      if (key) subscribersPaid.add(key);
    });

    return {
      activeAccessCount: activeGrants.length,
      paidSubscribersCount: subscribersPaid.size,
      totalRevenue,
    };
  }, [grants, payments]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Usuarios do sistema</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Painel administrativo de usuarios, acessos e assinaturas.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Usuarios com acesso ativo
          </p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {loading ? "..." : stats.activeAccessCount}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Baseado em registros ativos de acesso Ultra.
          </p>
        </article>

        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Assinantes pagantes
          </p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {loading ? "..." : stats.paidSubscribersCount}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Usuarios/pagadores unicos com pagamento aprovado.
          </p>
        </article>

        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Faturamento de assinaturas
          </p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {loading ? "..." : formatCurrency(stats.totalRevenue, { currency: "BRL" })}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Soma de pagamentos aprovados no Mercado Pago.
          </p>
        </article>
      </section>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </p>
      )}

      <UltraAccessManager />
      <SubscriptionPaymentsPanel />
    </div>
  );
}
