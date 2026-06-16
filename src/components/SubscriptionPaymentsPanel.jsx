import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { listMercadoPagoPayments } from "../services/mercadoPagoPayments.js";
import { sanitizeEmailInput } from "../config/accessControl.js";
import { formatCurrency } from "../utils/formatters.js";

const PANEL_OWNER_EMAIL = "balbino10@hotmail.com";
const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return DATE_FORMATTER.format(date);
}

function getStatusBadgeClasses(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") {
    return "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200";
  }
  if (normalized === "pending" || normalized === "in_process") {
    return "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200";
  }
  return "bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200";
}

export default function SubscriptionPaymentsPanel() {
  const { user } = useAuth();
  const normalizedEmail = useMemo(() => sanitizeEmailInput(user?.email ?? ""), [user?.email]);
  const canViewPanel = normalizedEmail === PANEL_OWNER_EMAIL;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const totalRevenue = useMemo(() => {
    return items.reduce((acc, item) => {
      const isApproved = String(item?.status || "").toLowerCase() === "approved";
      const amount = Number(item?.amount ?? 0);
      if (!isApproved || !Number.isFinite(amount)) return acc;
      return acc + amount;
    }, 0);
  }, [items]);

  const loadPayments = useCallback(async () => {
    if (!canViewPanel) return;
    setLoading(true);
    try {
      const data = await listMercadoPagoPayments({ limit: 50 });
      setItems(data);
      setError(null);
    } catch (loadError) {
      console.error("[settings] Falha ao carregar painel de assinaturas:", loadError);
      setError(loadError?.message ?? "Nao foi possivel carregar os pagamentos.");
    } finally {
      setLoading(false);
    }
  }, [canViewPanel]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  if (!canViewPanel) return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Painel de assinaturas Mercado Pago</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Visivel somente para {PANEL_OWNER_EMAIL}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
            Faturamento: {formatCurrency(totalRevenue, { currency: "BRL" })}
          </span>
          <button
            type="button"
            onClick={loadPayments}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </p>
      )}

      {!error && (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-xs dark:divide-gray-800">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-gray-950 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left">Processado em</th>
                <th className="px-3 py-2 text-left">Pagamento</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Plano</th>
                <th className="px-3 py-2 text-left">Usuario</th>
                <th className="px-3 py-2 text-left">Email pagador</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2 text-left">Resultado webhook</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-gray-500 dark:text-gray-400">
                    {loading ? "Carregando pagamentos..." : "Nenhum pagamento registrado ainda."}
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{formatDate(item.processed_at)}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-gray-700 dark:text-gray-300">{item.payment_id}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${getStatusBadgeClasses(item.status)}`}>
                      {item.status || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{item.plan || "—"}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-gray-700 dark:text-gray-300">{item.user_id || "—"}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{item.payer_email || "—"}</td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                    {Number.isFinite(Number(item.amount))
                      ? formatCurrency(Number(item.amount), { currency: item.currency || "BRL" })
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                    {item.webhook_result || "—"}
                    {item.webhook_reason ? ` (${item.webhook_reason})` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
