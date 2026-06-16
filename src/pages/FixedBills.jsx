import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import {
  createFixedBill,
  listFixedBills,
  listFixedBillOccurrences,
  updateFixedBill,
  upsertFixedBillOccurrence,
  updateFixedBillOccurrence,
} from "../services/fixedBills.js";
import { createExpense, deleteExpense } from "../services/expenses.js";
import { EXPENSE_CATEGORIES, FIXED_BILL_FREQUENCIES, FIXED_BILL_STATUS } from "../utils/constants.js";
import { formatCurrency, formatDate } from "../utils/formatters.js";
import { normalizeDateForSupabase, parseDecimalInput } from "../utils/forms.js";

const ACCOUNT_FORM_INITIAL = {
  nome: "",
  categoria: "outros",
  valor_previsto: "",
  frequencia: "mensal",
  dia_vencimento: "5",
  descricao: "",
};

const OCCURRENCE_FORM_INITIAL = {
  conta_fixa_id: "",
  referencia_mes: "",
  data_vencimento: "",
  valor_previsto: "",
  status: "pendente",
};

const ACCOUNT_FILTERS_INITIAL = {
  category: "all",
  status: "all",
};

function ensureNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildReferenceDate(monthInput) {
  if (!monthInput) return null;
  const [yearStr, monthStr] = monthInput.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return null;
  }
  const reference = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  if (Number.isNaN(reference.getTime())) {
    return null;
  }
  return reference.toISOString().slice(0, 10);
}

function computeDueDateFromMonth(monthInput, day) {
  if (!monthInput) return "";
  const [yearStr, monthStr] = monthInput.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const numericDay = Number(day);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(numericDay) ||
    numericDay < 1 ||
    numericDay > 31
  ) {
    return "";
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clampedDay = Math.min(numericDay, lastDay);
  const dueDate = new Date(Date.UTC(year, month - 1, clampedDay, 12, 0, 0));
  return Number.isNaN(dueDate.getTime()) ? "" : dueDate.toISOString().slice(0, 10);
}

function getCurrentMonthInput() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseUtcDate(value) {
  if (!value) return null;
  const iso = value.includes("T") ? value : `${value}T00:00:00Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getStatusBadgeClasses(status) {
  switch (status) {
    case "pago":
      return "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300";
    case "atrasado":
      return "bg-rose-500/15 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300";
    case "cancelado":
      return "bg-gray-500/15 text-gray-600 dark:bg-gray-500/10 dark:text-gray-300";
    default:
      return "bg-amber-500/15 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300";
  }
}

function getStatusLabel(status) {
  const option = FIXED_BILL_STATUS.find((item) => item.value === status);
  return option ? option.label : status;
}

const EXPENSE_CATEGORY_LABELS = Object.fromEntries(
  EXPENSE_CATEGORIES.map((category) => [category.value, category.label]),
);

export default function FixedBillsPage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [accountsState, setAccountsState] = useState({
    loading: true,
    items: [],
    error: null,
  });
  const [occurrencesState, setOccurrencesState] = useState({
    loading: true,
    items: [],
    error: null,
  });
  const [accountForm, setAccountForm] = useState(ACCOUNT_FORM_INITIAL);
  const [occurrenceForm, setOccurrenceForm] = useState(OCCURRENCE_FORM_INITIAL);
  const [submittingAccount, setSubmittingAccount] = useState(false);
  const [submittingOccurrence, setSubmittingOccurrence] = useState(false);
  const [markingMap, setMarkingMap] = useState({});
  const [updatingBillId, setUpdatingBillId] = useState(null);
  const [payingBillId, setPayingBillId] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(() => ({ ...ACCOUNT_FILTERS_INITIAL }));
  const allowedExpenseCategories = useMemo(
    () => new Set(EXPENSE_CATEGORIES.map((item) => item.value)),
    [],
  );

  const refreshAccounts = useCallback(async () => {
    if (!userId) return;
    setAccountsState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await listFixedBills({ userId });
      setAccountsState({ loading: false, items: data ?? [], error: null });
    } catch (error) {
      console.error(error);
      setAccountsState({ loading: false, items: [], error });
    }
  }, [userId]);

  const refreshOccurrences = useCallback(async () => {
    if (!userId) return;
    setOccurrencesState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await listFixedBillOccurrences({ userId, limit: 120 });
      setOccurrencesState({ loading: false, items: data ?? [], error: null });
    } catch (error) {
      console.error(error);
      setOccurrencesState({ loading: false, items: [], error });
    }
  }, [userId]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!userId) {
      setAccountsState({ loading: false, items: [], error: null });
      setOccurrencesState({ loading: false, items: [], error: null });
      return;
    }

    refreshAccounts();
    refreshOccurrences();
  }, [authLoading, userId, refreshAccounts, refreshOccurrences]);

  const accountsById = useMemo(() => {
    const map = new Map();
    for (const bill of accountsState.items) {
      map.set(String(bill.id), bill);
    }
    return map;
  }, [accountsState.items]);

  const filteredAccounts = useMemo(() => {
    return accountsState.items.filter((bill) => {
      if (filters.category !== "all") {
        const rawCategory = typeof bill.categoria === "string" ? bill.categoria.trim().toLowerCase() : "";
        if (rawCategory !== filters.category) {
          return false;
        }
      }
      if (filters.status === "active" && !bill.ativa) {
        return false;
      }
      if (filters.status === "archived" && bill.ativa) {
        return false;
      }
      return true;
    });
  }, [accountsState.items, filters]);

  const filtersApplied = useMemo(() => {
    return filters.category !== "all" || filters.status !== "all";
  }, [filters]);
  const hasBaseAccounts = accountsState.items.length > 0;
  const hasFilteredAccounts = filteredAccounts.length > 0;

  const summaryCards = useMemo(() => {
    const activeBills = filteredAccounts.filter((bill) => bill.ativa);
    const totalPlanned = activeBills.reduce(
      (sum, bill) => sum + ensureNumber(bill.valor_previsto),
      0,
    );

    const pendingOccurrences = occurrencesState.items.filter(
      (occurrence) => occurrence.status !== "pago" && occurrence.status !== "cancelado",
    );

    const pendingValue = pendingOccurrences.reduce(
      (sum, occurrence) => sum + ensureNumber(occurrence.valor_previsto),
      0,
    );

    return [
      {
        title: "Contas ativas",
        value: activeBills.length,
        helper: `${filteredAccounts.length} listadas.`,
      },
      {
        title: "Valor mensal previsto",
        value: formatCurrency(totalPlanned),
        helper: "Soma das contas com status ativo.",
      },
      {
        title: "Pendencias",
        value: pendingOccurrences.length,
        helper: formatCurrency(pendingValue),
      },
    ];
  }, [filteredAccounts, occurrencesState.items]);

  const occurrencesWithAccount = useMemo(() => {
    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    return occurrencesState.items.map((occurrence) => {
      const account = accountsById.get(String(occurrence.conta_fixa_id));
      const dueDate = parseUtcDate(occurrence.data_vencimento);
      const dueMs = dueDate ? dueDate.getTime() : null;
      const isOverdue =
        occurrence.status !== "pago" &&
        occurrence.status !== "cancelado" &&
        dueMs !== null &&
        dueMs < todayUtc;

      const accountCategoryRaw = typeof account?.categoria === "string" ? account.categoria.trim() : null;
      const accountCategory =
        accountCategoryRaw && allowedExpenseCategories.has(accountCategoryRaw.toLowerCase())
          ? accountCategoryRaw.toLowerCase()
          : null;

      return {
        ...occurrence,
        accountName: account?.nome ?? "Conta removida",
        accountCategory,
        accountDescription: account?.descricao ?? null,
        referenceLabel: occurrence.referencia_mes ? formatDate(occurrence.referencia_mes) : "-",
        dueLabel: occurrence.data_vencimento ? formatDate(occurrence.data_vencimento) : "-",
        valueLabel: formatCurrency(ensureNumber(occurrence.valor_previsto)),
        statusLabel: getStatusLabel(occurrence.status),
        statusClasses: getStatusBadgeClasses(occurrence.status),
        isOverdue,
      };
    });
  }, [accountsById, occurrencesState.items]);

  const showAuthNotice = !authLoading && !userId;

  const handleAccountInputChange = (event) => {
    const { name, value } = event.target;
    setAccountForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleOccurrenceInputChange = (event) => {
    const { name, value } = event.target;
    setOccurrenceForm((prev) => {
      let next = { ...prev, [name]: value };

      if (name === "conta_fixa_id") {
        const account = accountsById.get(value);
        if (account) {
          const reference = next.referencia_mes || getCurrentMonthInput();
          const dueDate = computeDueDateFromMonth(reference, Number(account.dia_vencimento));
          next = {
            ...next,
            referencia_mes: reference,
            valor_previsto: String(account.valor_previsto ?? ""),
            data_vencimento: dueDate,
          };
        } else {
          next = {
            ...next,
            valor_previsto: "",
            data_vencimento: "",
          };
        }
      }

      if (name === "referencia_mes") {
        const account = accountsById.get(next.conta_fixa_id);
        if (account) {
          next = {
            ...next,
            data_vencimento: computeDueDateFromMonth(value, Number(account.dia_vencimento)),
          };
        }
      }

      return next;
    });
  };
  const handleAccountFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleAccountFiltersClear = () => {
    setFilters({ ...ACCOUNT_FILTERS_INITIAL });
  };

  const handleAccountSubmit = async (event) => {
    event.preventDefault();
    if (!userId) return;

    setSubmittingAccount(true);
    try {
      const trimmedName = accountForm.nome.trim();
      if (!trimmedName) {
        throw new Error("Informe o nome da conta fixa.");
      }

      const parsedValue = parseDecimalInput(accountForm.valor_previsto);
      if (parsedValue === null) {
        throw new Error("Informe um valor previsto valido.");
      }

      const day = Number(accountForm.dia_vencimento);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        throw new Error("Informe um dia de vencimento entre 1 e 31.");
      }

      const payload = {
        user_id: userId,
        nome: trimmedName,
        categoria: accountForm.categoria || null,
        valor_previsto: Number(parsedValue.toFixed(2)),
        moeda: "BRL",
        frequencia: accountForm.frequencia || "mensal",
        dia_vencimento: day,
        descricao: accountForm.descricao || null,
        ativa: true,
      };

      await createFixedBill(payload);
      toast.success("Conta fixa cadastrada!");
      setAccountForm(ACCOUNT_FORM_INITIAL);
      refreshAccounts();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Nao foi possivel salvar a conta fixa.");
    } finally {
      setSubmittingAccount(false);
    }
  };

  const handleOccurrenceSubmit = async (event) => {
    event.preventDefault();
    if (!userId) return;

    setSubmittingOccurrence(true);
    try {
      if (!occurrenceForm.conta_fixa_id) {
        throw new Error("Selecione uma conta fixa.");
      }

      const bill = accountsById.get(occurrenceForm.conta_fixa_id);
      if (!bill) {
        throw new Error("Conta fixa invalida.");
      }

      const billId = Number.parseInt(occurrenceForm.conta_fixa_id, 10);
      if (!Number.isFinite(billId)) {
        throw new Error("Conta fixa invalida.");
      }

      const referenceMonth = occurrenceForm.referencia_mes || getCurrentMonthInput();
      const referenceDate = buildReferenceDate(referenceMonth);
      if (!referenceDate) {
        throw new Error("Informe o mes de referencia.");
      }

      const parsedValue =
        parseDecimalInput(
          occurrenceForm.valor_previsto !== ""
            ? occurrenceForm.valor_previsto
            : bill.valor_previsto,
        );

      if (parsedValue === null) {
        throw new Error("Informe um valor previsto valido.");
      }

      const dueInput =
        occurrenceForm.data_vencimento ||
        computeDueDateFromMonth(referenceMonth, Number(bill.dia_vencimento));
      const normalizedDue = normalizeDateForSupabase(dueInput);

      if (!normalizedDue?.date) {
        throw new Error("Informe uma data de vencimento valida.");
      }

      const payload = {
        user_id: userId,
        conta_fixa_id: billId,
        referencia_mes: referenceDate,
        data_vencimento: normalizedDue.date,
        valor_previsto: Number(parsedValue.toFixed(2)),
        status: occurrenceForm.status,
        valor_pago: null,
        data_pagamento: null,
        observacoes: null,
      };

      await upsertFixedBillOccurrence(payload);
      toast.success("Ocorrencia registrada!");
      setOccurrenceForm((prev) => ({
        ...OCCURRENCE_FORM_INITIAL,
        conta_fixa_id: prev.conta_fixa_id,
        referencia_mes: referenceMonth,
        data_vencimento: normalizedDue.date,
      }));
      refreshOccurrences();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Nao foi possivel registrar a ocorrencia.");
    } finally {
      setSubmittingOccurrence(false);
    }
  };

  const handleMarkAsPaid = async (occurrence) => {
    if (!occurrence?.id || !userId) return;
    setMarkingMap((prev) => ({ ...prev, [occurrence.id]: true }));
    const todayIso = new Date().toISOString().slice(0, 10);
    const paidValue = Number(ensureNumber(occurrence.valor_previsto ?? occurrence.valor_pago).toFixed(2));
    const account = accountsById.get(String(occurrence.conta_fixa_id));
    const fallbackCategory = "outros";
    const rawCategory = occurrence.accountCategory ?? account?.categoria ?? null;
    const normalizedCategory =
      typeof rawCategory === "string" ? rawCategory.trim().toLowerCase() : null;
    const category = normalizedCategory && allowedExpenseCategories.has(normalizedCategory)
      ? normalizedCategory
      : fallbackCategory;
    const descriptionParts = [];
    descriptionParts.push(`Pagamento da conta fixa ${occurrence.accountName ?? account?.nome ?? ""}`.trim());
    if (occurrence.referencia_mes) {
      descriptionParts.push(`Referência ${formatDate(occurrence.referencia_mes)}`);
    }
    if (occurrence.data_vencimento) {
      descriptionParts.push(`Vencimento ${formatDate(occurrence.data_vencimento)}`);
    }
    const expenseDescription = descriptionParts.filter(Boolean).join(" • ");
    let createdExpense = null;

    try {
      createdExpense = await createExpense({
        user_id: userId,
        value: paidValue,
        date: todayIso,
        category,
        payment_method: null,
        description: expenseDescription || "Pagamento de conta fixa",
      });

      await updateFixedBillOccurrence(occurrence.id, {
        status: "pago",
        data_pagamento: todayIso,
        valor_pago: paidValue,
      });
      toast.success("Pagamento registrado e lançado em despesas.");
      refreshOccurrences();
      refreshAccounts();
    } catch (error) {
      console.error(error);
      if (createdExpense?.id) {
        try {
          await deleteExpense(createdExpense.id);
        } catch (rollbackError) {
          console.error("Nao foi possivel desfazer a despesa criada:", rollbackError);
        }
      }
      toast.error("Nao foi possivel registrar o pagamento.");
    } finally {
      setMarkingMap((prev) => {
        const next = { ...prev };
        delete next[occurrence.id];
        return next;
      });
    }
  };
  const handleToggleBillActive = async (bill) => {
    if (!bill?.id) return;
    setUpdatingBillId(bill.id);
    try {
      await updateFixedBill(bill.id, { ativa: !bill.ativa });
      toast.success(bill.ativa ? "Conta arquivada." : "Conta ativada.");
      refreshAccounts();
      refreshOccurrences();
    } catch (error) {
      console.error(error);
      toast.error("Nao foi possivel atualizar a conta fixa.");
    } finally {
      setUpdatingBillId(null);
    }
  };

  const handlePayBill = async (bill) => {
    if (!bill?.id || !bill.ativa) {
      toast.error("Ative a conta fixa para registrar o pagamento.");
      return;
    }
    if (!userId) return;

    const monthInput = getCurrentMonthInput();
    const referenceIso = buildReferenceDate(monthInput);

    if (!referenceIso) {
      toast.error("Não foi possível identificar o mês atual.");
      return;
    }

    const existingOccurrence = occurrencesWithAccount.find(
      (item) =>
        String(item.conta_fixa_id) === String(bill.id) && item.referencia_mes === referenceIso,
    );

    if (existingOccurrence?.status === "pago") {
      toast.success("Esta conta já foi paga neste mês.");
      return;
    }

    setPayingBillId(bill.id);
    try {
      let occurrenceToPay = existingOccurrence;

      if (!occurrenceToPay) {
        const dueInput = computeDueDateFromMonth(monthInput, Number(bill.dia_vencimento));
        const normalizedDue = normalizeDateForSupabase(dueInput);
        const payload = {
          user_id: userId,
          conta_fixa_id: Number(bill.id),
          referencia_mes: referenceIso,
          data_vencimento: normalizedDue?.date ?? referenceIso,
          valor_previsto: Number(ensureNumber(bill.valor_previsto).toFixed(2)),
          status: "pendente",
          valor_pago: null,
          data_pagamento: null,
          observacoes: null,
        };

        const createdOccurrence = await upsertFixedBillOccurrence(payload);
        occurrenceToPay = {
          ...createdOccurrence,
          accountName: bill.nome,
        accountCategory:
          typeof bill.categoria === "string" && allowedExpenseCategories.has(bill.categoria.trim().toLowerCase())
            ? bill.categoria.trim().toLowerCase()
            : null,
        };
      }

      await handleMarkAsPaid({
        ...occurrenceToPay,
        accountName: occurrenceToPay.accountName ?? bill.nome,
        accountCategory:
          occurrenceToPay.accountCategory ??
          (typeof bill.categoria === "string" && allowedExpenseCategories.has(bill.categoria.trim().toLowerCase())
            ? bill.categoria.trim().toLowerCase()
            : null),
      });
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível registrar o pagamento desta conta.");
    } finally {
      setPayingBillId(null);
    }
  };

  const accountOptions = useMemo(() => {
    return accountsState.items
      .filter((bill) => bill.ativa)
      .map((bill) => ({ id: String(bill.id), label: bill.nome }));
  }, [accountsState.items]);

  const categoryPieOption = useMemo(() => {
    if (showAuthNotice || accountsState.loading || accountsState.error) return null;
    const totals = new Map();

    filteredAccounts.forEach((bill) => {
      const value = ensureNumber(bill.valor_previsto);
      if (!Number.isFinite(value) || value <= 0) return;
      const rawCategory = typeof bill.categoria === "string" ? bill.categoria.trim() : "";
      const normalizedKey = rawCategory.toLowerCase();
      const label = (EXPENSE_CATEGORY_LABELS[normalizedKey] ?? rawCategory) || "Sem categoria";
      totals.set(label, (totals.get(label) ?? 0) + value);
    });

    const data = Array.from(totals.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    if (!data.length) return null;

    return {
      tooltip: { trigger: "item", formatter: "{b}: R$ {c} ({d}%)" },
      legend: {
        bottom: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { fontSize: 11, color: "#475569" },
      },
      series: [
        {
          type: "pie",
          radius: ["35%", "70%"],
          center: ["50%", "45%"],
          itemStyle: { borderRadius: 8, borderColor: "#fff", borderWidth: 2 },
          label: {
            show: true,
            fontSize: 10,
            color: "#475569",
            formatter: ({ value }) => `R$ ${Number(value ?? 0).toFixed(0)}`,
          },
          data,
        },
      ],
      animation: false,
    };
  }, [accountsState.error, accountsState.loading, filteredAccounts, showAuthNotice]);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Contas fixas</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Cadastre recorrencias, gere ocorrencias mensais e acompanhe pagamentos sem perder prazos.
        </p>
      </header>

      {(!showAuthNotice && categoryPieOption) && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Valores por categoria
            </p>
            <span className="text-[11px] text-gray-400">Pizza</span>
          </div>
          <div className="mt-3 h-[17.5rem]">
            <ReactECharts option={categoryPieOption} style={{ height: "100%", width: "100%" }} opts={{ renderer: "svg" }} />
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Resumo rapido</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Visao geral das contas cadastradas e dos lancamentos em aberto.
            </p>
          </div>
          {!showAuthNotice && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen((prev) => !prev)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-temaSky hover:text-temaSky dark:border-gray-700 dark:text-gray-300 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
                aria-expanded={filtersOpen}
              >
                {filtersOpen ? "Fechar filtros" : "Filtros"}
                {filtersApplied && !filtersOpen && (
                  <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-temaSky dark:bg-temaEmerald" aria-hidden="true" />
                )}
              </button>
              {filtersApplied && (
                <button
                  type="button"
                  onClick={handleAccountFiltersClear}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-temaSky hover:text-temaSky dark:border-gray-700 dark:text-gray-300 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
                >
                  Limpar
                </button>
              )}
            </div>
          )}
        </div>

        {showAuthNotice && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Entre na sua conta para visualizar as contas fixas cadastradas.
          </p>
        )}

        {!showAuthNotice && (
          <>
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
              {summaryCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-950"
                >
                  <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">{card.title}</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {card.value}
                  </dd>
                  <dd className="text-xs text-gray-500 dark:text-gray-400">{card.helper}</dd>
                </div>
              ))}
            </dl>

            {filtersOpen && (
              <div className="mt-6 grid gap-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-800 dark:bg-gray-900/60">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                    Categoria
                    <select
                      name="category"
                      value={filters.category}
                      onChange={handleAccountFilterChange}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                    >
                      <option value="all">Todas</option>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                    Status
                    <select
                      name="status"
                      value={filters.status}
                      onChange={handleAccountFilterChange}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                    >
                      <option value="all">Todos</option>
                      <option value="active">Ativas</option>
                      <option value="archived">Arquivadas</option>
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Filtros afetam cards, grafico e tabela de contas.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAccountFiltersClear}
                      className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-temaSky hover:text-temaSky dark:border-gray-700 dark:text-gray-300 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
                    >
                      Limpar filtros
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      className="rounded-md bg-temaSky px-3 py-2 text-xs font-semibold text-white transition hover:bg-temaSky-dark dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cadastrar conta fixa</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Informe os dados da recorrencia. O valor sera utilizado como referencia para as ocorrencias.
            </p>
          </div>

          <form onSubmit={handleAccountSubmit} className="space-y-4 text-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 font-medium text-gray-700 dark:text-gray-200">
                Nome
                <input
                  name="nome"
                  type="text"
                  required
                  value={accountForm.nome}
                  onChange={handleAccountInputChange}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                  placeholder="Ex: Aluguel, Internet"
                />
              </label>
              <label className="flex flex-col gap-1 font-medium text-gray-700 dark:text-gray-200">
                Categoria
                <input
                  name="categoria"
                  type="text"
                  value={accountForm.categoria}
                  onChange={handleAccountInputChange}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                  placeholder="Opcional"
                />
              </label>
              <label className="flex flex-col gap-1 font-medium text-gray-700 dark:text-gray-200">
                Valor previsto (R$)
                <input
                  name="valor_previsto"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={accountForm.valor_previsto}
                  onChange={handleAccountInputChange}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                />
              </label>
              <label className="flex flex-col gap-1 font-medium text-gray-700 dark:text-gray-200">
                Frequencia
                <select
                  name="frequencia"
                  value={accountForm.frequencia}
                  onChange={handleAccountInputChange}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                >
                  {FIXED_BILL_FREQUENCIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 font-medium text-gray-700 dark:text-gray-200">
                Dia do vencimento
                <input
                  name="dia_vencimento"
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={accountForm.dia_vencimento}
                  onChange={handleAccountInputChange}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 font-medium text-gray-700 dark:text-gray-200">
              Observacoes
              <textarea
                name="descricao"
                rows={3}
                value={accountForm.descricao}
                onChange={handleAccountInputChange}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                placeholder="Detalhes adicionais para lembrar no futuro."
              />
            </label>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submittingAccount || showAuthNotice}
                className="inline-flex items-center justify-center rounded-lg bg-temaSky px-4 py-2 text-sm font-semibold text-white transition hover:bg-temaSky-dark disabled:cursor-not-allowed disabled:opacity-60 dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark"
              >
                {submittingAccount ? "Salvando..." : "Salvar conta fixa"}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Gerar ocorrencia</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Associe uma conta a um mes e acompanhe o pagamento individualmente.
            </p>
          </div>

          <form onSubmit={handleOccurrenceSubmit} className="space-y-4 text-sm">
            <label className="flex flex-col gap-1 font-medium text-gray-700 dark:text-gray-200">
              Conta fixa
              <select
                name="conta_fixa_id"
                value={occurrenceForm.conta_fixa_id}
                onChange={handleOccurrenceInputChange}
                required
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
              >
                <option value="">Selecione...</option>
                {accountOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 font-medium text-gray-700 dark:text-gray-200">
                Mes de referencia
                <input
                  name="referencia_mes"
                  type="month"
                  value={occurrenceForm.referencia_mes}
                  onChange={handleOccurrenceInputChange}
                  required
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                />
              </label>
              <label className="flex flex-col gap-1 font-medium text-gray-700 dark:text-gray-200">
                Data de vencimento
                <input
                  name="data_vencimento"
                  type="date"
                  value={occurrenceForm.data_vencimento}
                  onChange={handleOccurrenceInputChange}
                  required
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 font-medium text-gray-700 dark:text-gray-200">
                Valor previsto (R$)
                <input
                  name="valor_previsto"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={occurrenceForm.valor_previsto}
                  onChange={handleOccurrenceInputChange}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                />
              </label>
              <label className="flex flex-col gap-1 font-medium text-gray-700 dark:text-gray-200">
                Status
                <select
                  name="status"
                  value={occurrenceForm.status}
                  onChange={handleOccurrenceInputChange}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                >
                  {FIXED_BILL_STATUS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submittingOccurrence || showAuthNotice}
                className="inline-flex items-center justify-center rounded-lg bg-temaSky px-4 py-2 text-sm font-semibold text-white transition hover:bg-temaSky-dark disabled:cursor-not-allowed disabled:opacity-60 dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark"
              >
                {submittingOccurrence ? "Salvando..." : "Salvar ocorrencia"}
              </button>
            </div>
          </form>
        </div>
      </section>
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Contas cadastradas</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ative ou arquive contas conforme necessidade. Os valores permanecem disponiveis para historico.
            </p>
          </div>
        </div>

        {accountsState.loading && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Carregando contas fixas...</p>
        )}

        {!accountsState.loading && accountsState.error && (
          <p className="mt-4 text-sm text-rose-600 dark:text-rose-300">
            Nao foi possivel carregar as contas fixas. Tente novamente em instantes.
          </p>
        )}

        {!accountsState.loading && !accountsState.error && !hasBaseAccounts && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Nenhuma conta fixa cadastrada ate o momento.
          </p>
        )}

        {!accountsState.loading && !accountsState.error && hasBaseAccounts && !hasFilteredAccounts && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Nenhuma conta corresponde aos filtros atuais.
          </p>
        )}

        {!accountsState.loading && !accountsState.error && hasFilteredAccounts && (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/80">
                <tr className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-3 font-medium">Conta</th>
                  <th className="px-4 py-3 font-medium">Valor previsto</th>
                  <th className="px-4 py-3 font-medium">Frequencia</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredAccounts.map((bill) => (
                  <tr key={bill.id} className="text-sm text-gray-700 dark:text-gray-200">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{bill.nome}</span>
                        {bill.categoria && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{bill.categoria}</span>
                        )}
                        {bill.descricao && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{bill.descricao}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(ensureNumber(bill.valor_previsto))}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{bill.frequencia}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">Dia {bill.dia_vencimento}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                          bill.ativa
                            ? "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : "bg-gray-500/15 text-gray-600 dark:bg-gray-500/10 dark:text-gray-300"
                        }`}
                      >
                        {bill.ativa ? "Ativa" : "Arquivada"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handlePayBill(bill)}
                          disabled={!bill.ativa || payingBillId === bill.id}
                          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:border-temaSky hover:text-temaSky disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
                        >
                          {payingBillId === bill.id ? "Processando..." : "Pagar mês atual"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleBillActive(bill)}
                          disabled={updatingBillId === bill.id}
                          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:border-temaSky hover:text-temaSky disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
                        >
                          {bill.ativa ? "Arquivar" : "Ativar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ocorrencias registradas</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Marque como pago assim que o lancamento for quitado para manter a visao atualizada.
            </p>
          </div>
        </div>

        {occurrencesState.loading && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Carregando ocorrencias...</p>
        )}

        {!occurrencesState.loading && occurrencesState.error && (
          <p className="mt-4 text-sm text-rose-600 dark:text-rose-300">
            Nao foi possivel carregar as ocorrencias. Tente novamente em instantes.
          </p>
        )}

        {!occurrencesState.loading && !occurrencesState.error && occurrencesWithAccount.length === 0 && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Nenhuma ocorrencia cadastrada. Gere um ciclo utilizando o formulario ao lado.
          </p>
        )}

        {!occurrencesState.loading && !occurrencesState.error && occurrencesWithAccount.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/80">
                <tr className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-3 font-medium">Conta</th>
                  <th className="px-4 py-3 font-medium">Referencia</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {occurrencesWithAccount.map((occurrence) => (
                  <tr
                    key={occurrence.id}
                    className={`text-sm text-gray-700 dark:text-gray-200 ${
                      occurrence.isOverdue ? "bg-rose-50/60 dark:bg-rose-500/10" : ""
                    }`}
                  >
                    <td className="px-4 py-3">{occurrence.accountName}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {occurrence.referenceLabel}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {occurrence.dueLabel}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      {occurrence.valueLabel}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${occurrence.statusClasses}`}
                      >
                        {occurrence.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {occurrence.status !== "pago" && occurrence.status !== "cancelado" && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsPaid(occurrence)}
                          disabled={Boolean(markingMap[occurrence.id])}
                          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:border-temaSky hover:text-temaSky disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
                        >
                          {markingMap[occurrence.id] ? "Processando..." : "Pagar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
