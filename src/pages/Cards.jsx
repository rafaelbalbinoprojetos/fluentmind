import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import { useAuth } from "../context/AuthContext.jsx";
import * as creditCardsService from "../services/creditCards.js";
import { deleteExpense, listExpenses } from "../services/expenses.js";
import { parseDecimalInput } from "../utils/forms.js";
import { formatCurrency, formatDate } from "../utils/formatters.js";
import { EXPENSE_CATEGORIES } from "../utils/constants.js";

const INITIAL_FORM = {
  name: "",
  brand: "",
  credit_limit: "",
  due_day: "",
  closing_day: "",
};

const CATEGORY_LABELS = Object.fromEntries(
  EXPENSE_CATEGORIES.map((category) => [category.value, category.label]),
);
const BILLING_MONTH_FORMATTER = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" });

function formatBillingMonth(value) {
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return BILLING_MONTH_FORMATTER.format(parsed).replace(".", "");
}

function colorFromCardId(cardId) {
  const raw = String(cardId || "");
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 70%, 48%)`;
}

function normalizeCardForm(form) {
  const name = String(form.name || "").trim();
  const brand = String(form.brand || "").trim() || null;
  const parsedLimit = parseDecimalInput(form.credit_limit);
  const dueDay = Number(form.due_day);
  const closingDayRaw = String(form.closing_day || "").trim();
  const closingDay = closingDayRaw ? Number(closingDayRaw) : null;

  if (!name) {
    throw new Error("Informe o nome do cartao.");
  }
  if (parsedLimit === null || Number(parsedLimit) <= 0) {
    throw new Error("Informe um limite valido.");
  }
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new Error("Informe o vencimento entre 1 e 31.");
  }
  if (closingDay !== null && (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31)) {
    throw new Error("Informe o fechamento entre 1 e 31 ou deixe em branco.");
  }

  return {
    name,
    brand,
    credit_limit: Number(parsedLimit.toFixed(2)),
    due_day: dueDay,
    closing_day: closingDay,
  };
}

function toCardForm(card) {
  if (!card) return INITIAL_FORM;
  return {
    name: card.name ?? "",
    brand: card.brand ?? "",
    credit_limit: card.credit_limit !== null && card.credit_limit !== undefined ? String(card.credit_limit) : "",
    due_day: card.due_day !== null && card.due_day !== undefined ? String(card.due_day) : "",
    closing_day: card.closing_day !== null && card.closing_day !== undefined ? String(card.closing_day) : "",
  };
}

export default function CardsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState(null);
  const [expenseCardFilter, setExpenseCardFilter] = useState("all");
  const [chartRangeMonths, setChartRangeMonths] = useState("6");

  useEffect(() => {
    let ignore = false;

    if (authLoading) return undefined;
    if (!user?.id) {
      setCards([]);
      setExpenses([]);
      setLoading(false);
      return undefined;
    }

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [cardData, expenseData] = await Promise.all([
          creditCardsService.listCreditCards({ userId: user.id }),
          listExpenses({ userId: user.id }),
        ]);
        if (ignore) return;
        setCards(cardData ?? []);
        setExpenses(expenseData ?? []);
      } catch (fetchError) {
        console.error(fetchError);
        if (ignore) return;
        setError(fetchError);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchData();
    return () => {
      ignore = true;
    };
  }, [authLoading, user?.id]);

  const usageByCard = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const accumulator = new Map();

    expenses.forEach((expense) => {
      if (expense.payment_method !== "cartao" || !expense.card_id) return;
      const value = Math.abs(Number(expense.value) || 0);
      if (!Number.isFinite(value) || value <= 0) return;

      const item = accumulator.get(expense.card_id) ?? { total: 0, currentMonth: 0, count: 0 };
      item.total += value;
      item.count += 1;

      const rawDate = expense.date ? new Date(`${expense.date}T00:00:00`) : null;
      if (rawDate && !Number.isNaN(rawDate.getTime()) && rawDate.getFullYear() === currentYear && rawDate.getMonth() === currentMonth) {
        item.currentMonth += value;
      }

      accumulator.set(expense.card_id, item);
    });

    return accumulator;
  }, [expenses]);

  const cardsView = useMemo(() => {
    return cards.map((card) => {
      const usage = usageByCard.get(card.id) ?? { total: 0, currentMonth: 0, count: 0 };
      const limit = Number(card.credit_limit);
      const safeLimit = Number.isFinite(limit) ? limit : 0;
      const available = safeLimit > 0 ? safeLimit - usage.currentMonth : null;
      return {
        ...card,
        usage,
        safeLimit,
        available,
      };
    });
  }, [cards, usageByCard]);
  const cardNameById = useMemo(() => {
    const map = new Map();
    cards.forEach((card) => map.set(card.id, card.name));
    return map;
  }, [cards]);
  const cardExpenseRows = useMemo(() => {
    return expenses
      .filter((expense) => expense.payment_method === "cartao" && expense.card_id)
      .map((expense) => {
        const amount = Number(expense.value);
        const numericValue = Number.isFinite(amount) ? Math.abs(amount) : 0;
        const dateRaw = expense.date ? String(expense.date).slice(0, 10) : "";
        return {
          id: expense.id,
          raw: expense,
          cardId: expense.card_id,
          cardName: cardNameById.get(expense.card_id) ?? expense.card?.name ?? "Cartao removido",
          dateRaw,
          date: formatDate(expense.date),
          description: expense.description?.trim() || "—",
          category: CATEGORY_LABELS[expense.category] ?? expense.category ?? "Sem categoria",
          installment:
            expense.is_installment && expense.installment_number && expense.installment_total
              ? `${expense.installment_number}/${expense.installment_total}`
              : "—",
          billedMonth: formatBillingMonth(expense.billed_month || expense.date),
          value: formatCurrency(numericValue * -1, { sign: "negative" }),
        };
      })
      .sort((a, b) => b.dateRaw.localeCompare(a.dateRaw));
  }, [cardNameById, expenses]);
  const filteredCardExpenseRows = useMemo(() => {
    if (expenseCardFilter === "all") return cardExpenseRows;
    return cardExpenseRows.filter((row) => row.cardId === expenseCardFilter);
  }, [cardExpenseRows, expenseCardFilter]);
  const cardMonthlyBarOption = useMemo(() => {
    const monthMap = new Map();

    expenses.forEach((expense) => {
      if (expense.payment_method !== "cartao" || !expense.card_id) return;
      const cardId = expense.card_id;
      const rawMonth = String(expense.billed_month || expense.date || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(rawMonth)) return;
      const value = Math.abs(Number(expense.value) || 0);
      if (!Number.isFinite(value) || value <= 0) return;

      const monthEntry = monthMap.get(rawMonth) ?? new Map();
      monthEntry.set(cardId, (monthEntry.get(cardId) ?? 0) + value);
      monthMap.set(rawMonth, monthEntry);
    });

    const allMonths = Array.from(monthMap.keys()).sort((a, b) => a.localeCompare(b));
    if (allMonths.length === 0) return null;

    const range = Number(chartRangeMonths);
    const visibleMonths = Number.isFinite(range) && range > 0 ? allMonths.slice(-range) : allMonths;
    const cardIds = Array.from(
      new Set(
        visibleMonths.flatMap((month) => Array.from((monthMap.get(month) ?? new Map()).keys())),
      ),
    ).sort((a, b) =>
      String(cardNameById.get(a) ?? "Cartao removido").localeCompare(
        String(cardNameById.get(b) ?? "Cartao removido"),
        "pt-BR",
      ),
    );

    const labels = visibleMonths.map((month) => formatBillingMonth(`${month}-01`));
    const series = cardIds.map((cardId) => ({
      name: cardNameById.get(cardId) ?? "Cartao removido",
      type: "bar",
      data: visibleMonths.map((month) => Number(((monthMap.get(month)?.get(cardId) ?? 0).toFixed(2)))),
      itemStyle: { color: colorFromCardId(cardId), borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 28,
    }));

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (value) => formatCurrency(Number(value || 0)),
      },
      legend: {
        type: "scroll",
        top: 0,
      },
      grid: { left: 8, right: 8, top: 48, bottom: 28, containLabel: true },
      xAxis: {
        type: "category",
        data: labels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#e2e8f0" } },
      },
      series,
      animation: false,
    };
  }, [cardNameById, chartRangeMonths, expenses]);

  const openCreateForm = () => {
    setEditingCard(null);
    setFormData(INITIAL_FORM);
    setFormOpen(true);
  };

  const openEditForm = (card) => {
    setEditingCard(card);
    setFormData(toCardForm(card));
    setFormOpen(true);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    try {
      const payload = normalizeCardForm(formData);
      let saved = null;
      if (editingCard?.id) {
        saved = await creditCardsService.updateCreditCard(editingCard.id, payload);
        setCards((prev) => prev.map((card) => (card.id === saved.id ? saved : card)));
        toast.success("Cartao atualizado com sucesso.");
      } else {
        saved = await creditCardsService.createCreditCard({ ...payload, user_id: user.id });
        setCards((prev) => [...prev, saved].sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR")));
        toast.success("Cartao cadastrado com sucesso.");
      }
      setFormOpen(false);
      setEditingCard(null);
      setFormData(INITIAL_FORM);
    } catch (submitError) {
      console.error(submitError);
      toast.error(submitError.message || "Nao foi possivel salvar o cartao.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (card) => {
    if (!card?.id) return;
    const confirmDelete = window.confirm(`Deseja excluir o cartao "${card.name}"?`);
    if (!confirmDelete) return;

    setDeletingId(card.id);
    try {
      if (typeof creditCardsService.deleteCreditCard !== "function") {
        throw new Error("Servico de exclusao de cartao indisponivel. Recarregue a pagina.");
      }
      await creditCardsService.deleteCreditCard(card.id);
      setCards((prev) => prev.filter((item) => item.id !== card.id));
      toast.success("Cartao excluido com sucesso.");
    } catch (deleteError) {
      console.error(deleteError);
      toast.error("Nao foi possivel excluir o cartao.");
    } finally {
      setDeletingId(null);
    }
  };
  const handleEditExpense = (record) => {
    navigate("/despesas/nova", { state: { record } });
  };
  const handleDeleteExpense = async (record) => {
    if (!record?.id) return;
    const confirmed = window.confirm("Deseja excluir este lancamento?");
    if (!confirmed) return;

    setDeletingExpenseId(record.id);
    try {
      await deleteExpense(record.id);
      setExpenses((prev) => prev.filter((item) => item.id !== record.id));
      toast.success("Lancamento excluido com sucesso.");
    } catch (deleteError) {
      console.error(deleteError);
      toast.error("Nao foi possivel excluir o lancamento.");
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const showAuthNotice = !authLoading && !user;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Gestao de cartoes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Cadastre limite, vencimento e fechamento para controlar melhor suas faturas.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center justify-center rounded-lg bg-temaSky px-4 py-2 text-sm font-semibold text-white transition hover:bg-temaSky-dark dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark"
        >
          Novo cartao
        </button>
      </header>

      {formOpen && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {editingCard ? "Editar cartao" : "Novo cartao"}
          </h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                Nome
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder="Ex.: Nubank Roxo"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                Bandeira (opcional)
                <input
                  name="brand"
                  value={formData.brand}
                  onChange={handleFormChange}
                  placeholder="Ex.: Visa, Mastercard"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                Limite (R$)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="credit_limit"
                  value={formData.credit_limit}
                  onChange={handleFormChange}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                Vencimento (1-31)
                <input
                  type="number"
                  min="1"
                  max="31"
                  name="due_day"
                  value={formData.due_day}
                  onChange={handleFormChange}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 md:col-span-2">
                Fechamento (opcional, 1-31)
                <input
                  type="number"
                  min="1"
                  max="31"
                  name="closing_day"
                  value={formData.closing_day}
                  onChange={handleFormChange}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                />
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setEditingCard(null);
                  setFormData(INITIAL_FORM);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-400 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-lg bg-temaSky px-4 py-2 text-sm font-semibold text-white transition hover:bg-temaSky-dark disabled:cursor-not-allowed disabled:opacity-60 dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark"
              >
                {saving ? "Salvando..." : editingCard ? "Atualizar cartao" : "Salvar cartao"}
              </button>
            </div>
          </form>
        </section>
      )}

      {showAuthNotice && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          Entre na sua conta para gerenciar seus cartoes.
        </section>
      )}

      {loading && !showAuthNotice && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          Carregando cartoes...
        </section>
      )}

      {error && !showAuthNotice && !loading && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200">
          Nao foi possivel carregar os cartoes agora.
        </section>
      )}

      {!showAuthNotice && !loading && !error && cardsView.length === 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          Nenhum cartao cadastrado ainda. Clique em <strong>Novo cartao</strong> para comecar.
        </section>
      )}

      {!showAuthNotice && !loading && !error && cardsView.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cardsView.map((card) => (
            <article
              key={card.id}
              className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{card.name}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{card.brand || "Bandeira nao informada"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditForm(card)}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:border-temaSky hover:text-temaSky dark:border-gray-700 dark:text-gray-300 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(card)}
                    disabled={deletingId === card.id}
                    className="rounded-md border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-700/60 dark:text-rose-300 dark:hover:bg-rose-900/20"
                  >
                    {deletingId === card.id ? "Excluindo..." : "Excluir"}
                  </button>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                  <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Limite</dt>
                  <dd className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(card.safeLimit || 0)}
                  </dd>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                  <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Vencimento</dt>
                  <dd className="mt-1 font-semibold text-gray-900 dark:text-gray-100">Dia {card.due_day ?? "-"}</dd>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                  <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Fechamento</dt>
                  <dd className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                    {card.closing_day ? `Dia ${card.closing_day}` : "Nao informado"}
                  </dd>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                  <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Fatura mes</dt>
                  <dd className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(card.usage.currentMonth || 0)}
                  </dd>
                </div>
              </dl>

              <div className="rounded-lg border border-dashed border-gray-300 p-3 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
                <p>Total em despesas no credito: {formatCurrency(card.usage.total || 0)}</p>
                <p>Quantidade de lancamentos: {card.usage.count}</p>
                <p>
                  Disponivel no mes:{" "}
                  {card.available === null ? "—" : formatCurrency(Math.max(card.available, 0))}
                </p>
              </div>
            </article>
          ))}
        </section>
      )}

      {!showAuthNotice && !loading && !error && cardMonthlyBarOption && (
        <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Evolucao mensal por cartao</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Comparativo de gastos no credito por mes de fatura.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
              Periodo
              <select
                value={chartRangeMonths}
                onChange={(event) => setChartRangeMonths(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
              >
                <option value="6">Ultimos 6 meses</option>
                <option value="12">Ultimos 12 meses</option>
                <option value="24">Ultimos 24 meses</option>
              </select>
            </label>
          </div>
          <div className="h-[22rem]">
            <ReactECharts option={cardMonthlyBarOption} style={{ height: "100%", width: "100%" }} opts={{ renderer: "svg" }} />
          </div>
        </section>
      )}

      {!showAuthNotice && !loading && !error && (cardsView.length > 0 || cardExpenseRows.length > 0) && (
        <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Lancamentos de cartoes</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Consulte e gerencie os lancamentos de credito sem sair desta pagina.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
              Cartao
              <select
                value={expenseCardFilter}
                onChange={(event) => setExpenseCardFilter(event.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
              >
                <option value="all">Todos</option>
                {cardsView.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/70">
                <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2 font-medium">Cartao</th>
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Descricao</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 font-medium">Parcela</th>
                  <th className="px-3 py-2 font-medium">Fatura</th>
                  <th className="px-3 py-2 font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredCardExpenseRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhum lancamento de cartao encontrado para o filtro atual.
                    </td>
                  </tr>
                )}
                {filteredCardExpenseRows.map((row) => (
                  <tr key={row.id} className="text-gray-700 dark:text-gray-300">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{row.cardName}</td>
                    <td className="whitespace-nowrap px-3 py-2">{row.date}</td>
                    <td className="max-w-[16rem] truncate px-3 py-2" title={row.description}>
                      {row.description}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{row.category}</td>
                    <td className="whitespace-nowrap px-3 py-2">{row.installment}</td>
                    <td className="whitespace-nowrap px-3 py-2">{row.billedMonth}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-rose-600 dark:text-rose-300">{row.value}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditExpense(row.raw)}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-600 transition hover:border-temaSky hover:text-temaSky dark:border-gray-700 dark:text-gray-300 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(row.raw)}
                          disabled={deletingExpenseId === row.id}
                          className="rounded-md border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-700/60 dark:text-rose-300 dark:hover:bg-rose-900/20"
                        >
                          {deletingExpenseId === row.id ? "Excluindo..." : "Excluir"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </div>
  );
}
