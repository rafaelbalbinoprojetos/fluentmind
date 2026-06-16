import React, { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import { deleteExpense, listExpenses } from "../services/expenses.js";
import RecordActions from "../components/RecordActions.jsx";
import LucideIcon from "../components/LucideIcon.jsx";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "../utils/constants.js";
import { formatCurrency, formatDate } from "../utils/formatters.js";

const CATEGORY_LABELS = Object.fromEntries(
  EXPENSE_CATEGORIES.map((category) => [category.value, category.label]),
);

const PAYMENT_METHOD_LABELS = Object.fromEntries(
  PAYMENT_METHODS.map((method) => [method.value, method.label]),
);

const DEFAULT_EXPENSE_FILTERS = {
  category: "all",
  paymentMethod: "all",
  search: "",
  dateFrom: "",
  dateTo: "",
  minValue: "",
  maxValue: "",
};

export default function ExpensesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState({
    loading: true,
    data: [],
    error: null,
  });
  const [selectedExpenseId, setSelectedExpenseId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_EXPENSE_FILTERS }));

  useEffect(() => {
    let ignore = false;

    if (authLoading) {
      return undefined;
    }

    if (!user) {
      setState({ loading: false, data: [], error: null });
      setSelectedExpenseId(null);
      return undefined;
    }

    async function fetchExpenses() {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const items = await listExpenses({ userId: user.id });
        if (ignore) return;
        setState({ loading: false, data: items ?? [], error: null });
      } catch (error) {
        console.error(error);
        if (ignore) return;
        setState({ loading: false, data: [], error });
      }
    }

    fetchExpenses();

    return () => {
      ignore = true;
    };
  }, [authLoading, user, user?.id]);

  const expenses = useMemo(
    () =>
      state.data.map((expense) => {
        const amount = Number(expense.value);
        const signedAmount = Number.isFinite(amount) ? -Math.abs(amount) : null;
        return {
          id: expense.id,
          raw: expense,
          numericValue: Number.isFinite(amount) ? amount : null,
          category:
            CATEGORY_LABELS[expense.category] ?? expense.category ?? "Sem categoria",
          description: expense.description?.trim() || "—",
          paymentMethod: expense.payment_method
            ? expense.payment_method === "cartao" && expense.card?.name
              ? `${PAYMENT_METHOD_LABELS[expense.payment_method] ?? expense.payment_method} - ${expense.card.name}`
              : PAYMENT_METHOD_LABELS[expense.payment_method] ?? expense.payment_method
            : "—",
          installmentLabel:
            expense.is_installment && expense.installment_number && expense.installment_total
              ? `Parcela ${expense.installment_number}/${expense.installment_total}`
              : "",
          date: formatDate(expense.date),
          value: Number.isFinite(signedAmount)
            ? formatCurrency(signedAmount, { sign: "negative" })
            : formatCurrency(expense.value, { sign: "negative" }),
        };
      }),
    [state.data],
  );

  const parseFilterNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, numeric) : null;
  };

  const filteredExpenses = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
    const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;
    const minValue = parseFilterNumber(filters.minValue);
    const maxValue = parseFilterNumber(filters.maxValue);

    return expenses.filter((expense) => {
      const { raw } = expense;

      if (filters.category !== "all" && raw.category !== filters.category) {
        return false;
      }

      if (filters.paymentMethod !== "all" && raw.payment_method !== filters.paymentMethod) {
        return false;
      }

      if (normalizedSearch) {
        const haystack = `${expense.description} ${expense.category} ${expense.paymentMethod}`
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "");
        const needle = normalizedSearch
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "");
        if (!haystack.includes(needle)) {
          return false;
        }
      }

      if (fromDate || toDate) {
        const expenseDate = raw.date ? new Date(raw.date) : null;
        if (!expenseDate || Number.isNaN(expenseDate.getTime())) {
          return false;
        }
        if (fromDate && expenseDate < fromDate) {
          return false;
        }
        if (toDate && expenseDate > toDate) {
          return false;
        }
      }

      if (minValue !== null && (expense.numericValue ?? 0) < minValue) {
        return false;
      }

      if (maxValue !== null && (expense.numericValue ?? 0) > maxValue) {
        return false;
      }

      return true;
    });
  }, [expenses, filters]);

  const filtersApplied = useMemo(() => {
    return (
      filters.category !== "all" ||
      filters.paymentMethod !== "all" ||
      filters.search.trim() !== "" ||
      filters.dateFrom !== "" ||
      filters.dateTo !== "" ||
      filters.minValue !== "" ||
      filters.maxValue !== ""
    );
  }, [filters]);

  const totals = useMemo(() => {
    if (!filteredExpenses.length) {
      return {
        totalValue: 0,
        averageValue: 0,
        highestValue: 0,
      };
    }
    const totalValue = filteredExpenses.reduce((sum, expense) => sum + (expense.numericValue ?? 0), 0);
    const highestValue = filteredExpenses.reduce(
      (max, expense) => Math.max(max, expense.numericValue ?? 0),
      0,
    );
    const averageValue = totalValue / filteredExpenses.length;
    return { totalValue, averageValue, highestValue };
  }, [filteredExpenses]);

  const selectedExpense = useMemo(
    () => expenses.find((expense) => expense.id === selectedExpenseId) ?? null,
    [expenses, selectedExpenseId],
  );

  const showAuthNotice = !authLoading && !user;
  const isLoading = authLoading || state.loading;

  const handleView = (id) => {
    setSelectedExpenseId((current) => (current === id ? null : id));
  };

  const handleEdit = (record) => {
    navigate("/despesas/nova", { state: { record } });
  };

  const handleDelete = async (record) => {
    if (!record?.id) return;
    const confirmed = window.confirm("Tem certeza que deseja excluir esta despesa?");
    if (!confirmed) return;

    setDeletingId(record.id);
    try {
      await deleteExpense(record.id);
      setState((prev) => ({
        ...prev,
        data: prev.data.filter((item) => item.id !== record.id),
      }));
      setSelectedExpenseId((current) => (current === record.id ? null : current));
      toast.success("Despesa excluida com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Nao foi possivel excluir a despesa.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleFilterInputChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleClearFilters = () => {
    setFilters({ ...DEFAULT_EXPENSE_FILTERS });
  };

  const { uniqueCategories, lastExpense } = useMemo(() => {
    if (filteredExpenses.length === 0) {
      return { uniqueCategories: 0, lastExpense: null };
    }
    const categorySet = new Set(
      filteredExpenses.map((expense) => expense.raw?.category ?? expense.category ?? ""),
    );
    categorySet.delete("");

    const lastDated = filteredExpenses
      .map((expense) => {
        const rawDate = expense.raw?.date ? new Date(expense.raw.date) : null;
        return { expense, rawDate };
      })
      .filter(({ rawDate }) => rawDate && !Number.isNaN(rawDate.getTime()))
      .sort((a, b) => b.rawDate - a.rawDate);

    return {
      uniqueCategories: categorySet.size,
      lastExpense: lastDated[0]?.expense ?? null,
    };
  }, [filteredExpenses]);

  const summaryInfo = useMemo(() => {
    const hasItems = filteredExpenses.length > 0;
    const totalValue = hasItems ? totals.totalValue : 0;
    const averageValue = hasItems ? totals.averageValue : 0;

    return {
      hasItems,
      totalDisplay: formatCurrency(totalValue * -1, { sign: "negative" }),
      averageDisplay: formatCurrency(averageValue * -1, { sign: "negative" }),
      categoriesCount: hasItems ? uniqueCategories : 0,
      lastExpenseInfo:
        hasItems && lastExpense
          ? {
              date: lastExpense.date,
              description: lastExpense.description,
              value: lastExpense.value,
            }
          : null,
    };
  }, [filteredExpenses.length, totals.totalValue, totals.averageValue, uniqueCategories, lastExpense]);

  const summaryCards = useMemo(() => {
    if (isLoading || showAuthNotice || state.error) {
      return [];
    }

    if (!summaryInfo.hasItems) {
      return [
        {
          title: "Sem despesas",
          value: "-",
          helper: "Ajuste os filtros ou cadastre uma despesa para ver o resumo.",
        },
      ];
    }

    const highestDisplay = formatCurrency(totals.highestValue * -1, { sign: "negative" });
    const recordsHelper =
      filteredExpenses.length === 1
        ? "1 despesa filtrada."
        : `${filteredExpenses.length} despesas filtradas.`;

    return [
      {
        title: "Despesas filtradas",
        value: summaryInfo.totalDisplay,
        helper: recordsHelper,
      },
      {
        title: "Ticket medio",
        value: summaryInfo.averageDisplay,
        helper: "Media das despesas visiveis nos filtros.",
      },
      {
        title: "Maior despesa",
        value: highestDisplay,
        helper: "Valor mais alto encontrado na lista atual.",
      },
    ];
  }, [
    filteredExpenses.length,
    isLoading,
    showAuthNotice,
    state.error,
    summaryInfo.averageDisplay,
    summaryInfo.hasItems,
    summaryInfo.totalDisplay,
    totals.highestValue,
  ]);

  const hasExportableData =
    !isLoading && !showAuthNotice && !state.error && filteredExpenses.length > 0;

  const categoryBarOption = useMemo(() => {
    if (!hasExportableData) return null;

    const totalsByCategory = new Map();
    filteredExpenses.forEach((expense) => {
      const value = Math.abs(expense.numericValue ?? 0);
      if (!Number.isFinite(value) || value <= 0) return;
      const key = expense.category || "Sem categoria";
      totalsByCategory.set(key, (totalsByCategory.get(key) ?? 0) + value);
    });

    const items = Array.from(totalsByCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    if (!items.length) return null;

    const labels = items.map(([label]) => label);
    const values = items.map(([, value]) => Number(value.toFixed(2)));
    const maxValue = Math.max(...values, 0) || 1;

    return {
      color: ["#f43f5e"],
      grid: { top: 8, bottom: 8, left: 8, right: 8, containLabel: true },
      xAxis: { type: "value", show: false, max: maxValue * 1.2 },
      yAxis: {
        type: "category",
        data: labels,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: "#475569", fontSize: 10 },
      },
      series: [
        {
          name: "Categorias",
          type: "bar",
          data: values,
          barWidth: 12,
          label: {
            show: true,
            position: "right",
            color: "#0f172a",
            fontSize: 10,
            formatter: ({ value }) => `R$ ${Number(value).toFixed(0)}`,
          },
          itemStyle: { borderRadius: [6, 6, 6, 6] },
        },
      ],
      animation: false,
    };
  }, [filteredExpenses, hasExportableData]);

  const ticketBarOption = useMemo(() => {
    if (!hasExportableData) return null;
    const values = filteredExpenses
      .map((expense) => Math.abs(expense.numericValue ?? 0))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (!values.length) return null;

    const recent = values.slice(-12);
    const average = totals.averageValue ?? 0;

    return {
      color: ["#0ea5e9"],
      grid: { top: 6, bottom: 20, left: 6, right: 6 },
      xAxis: {
        type: "category",
        data: recent.map((_, index) => index + 1),
        show: false,
      },
      yAxis: { type: "value", show: false },
      series: [
        {
          type: "bar",
          data: recent.map((value) => Number(value.toFixed(2))),
          barWidth: "60%",
          itemStyle: { borderRadius: [6, 6, 6, 6] },
          label: {
            show: true,
            position: "top",
            fontSize: 10,
            color: "#475569",
            formatter: ({ value }) => `R$ ${Number(value ?? 0).toFixed(0)}`,
          },
        },
        {
          type: "line",
          data: recent.map(() => Number(average.toFixed(2))),
          smooth: true,
          symbol: "none",
          lineStyle: { color: "#f97316", width: 2, type: "dashed" },
          name: "Ticket medio",
        },
      ],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const barValue = params.find((item) => item.seriesType === "bar")?.value;
          return `Despesa: R$ ${Number(barValue ?? 0).toFixed(2)}<br/>Media: R$ ${Number(average).toFixed(2)}`;
        },
      },
      animation: false,
    };
  }, [filteredExpenses, hasExportableData, totals.averageValue]);

  const evolutionLineOption = useMemo(() => {
    if (!hasExportableData) return null;
    const totalsByDate = new Map();

    filteredExpenses.forEach((expense) => {
      const dateStr = expense.raw?.date ? String(expense.raw.date).slice(0, 10) : null;
      if (!dateStr) return;
      const numeric = Math.abs(expense.numericValue ?? 0);
      if (!Number.isFinite(numeric) || numeric <= 0) return;
      totalsByDate.set(dateStr, (totalsByDate.get(dateStr) ?? 0) + numeric);
    });

    const items = Array.from(totalsByDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    if (!items.length) return null;

    const labels = items.map(([date]) => {
      const parsed = new Date(`${date}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) return date;
      return parsed.toLocaleDateString("pt-BR", { month: "short", day: "2-digit" }).replace(".", "");
    });
    const values = items.map(([, value]) => Number(value.toFixed(2)));

    return {
      color: ["#6366f1"],
      grid: { top: 10, bottom: 20, left: 8, right: 8 },
      xAxis: {
        type: "category",
        data: labels,
        boundaryGap: false,
        axisLabel: { color: "#475569", fontSize: 10 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#e2e8f0" } },
      },
      yAxis: {
        type: "value",
        show: false,
      },
      series: [
        {
          type: "line",
          smooth: true,
          data: values,
          showSymbol: false,
          areaStyle: {
            color: "rgba(99,102,241,0.15)",
          },
          lineStyle: { width: 2 },
          label: {
            show: true,
            position: "top",
            fontSize: 10,
            color: "#475569",
            formatter: ({ value }) => `R$ ${Number(value ?? 0).toFixed(0)}`,
          },
        },
      ],
      tooltip: {
        trigger: "axis",
        formatter: (params) => {
          const item = params[0];
          return `${item.axisValue}<br/>Total: R$ ${Number(item.value ?? 0).toFixed(2)}`;
        },
      },
      animation: false,
    };
  }, [filteredExpenses, hasExportableData]);

  const sanitizeForCsv = (value) => {
    if (value === null || value === undefined) return '""';
    const cleaned = String(value).replace(/\r?\n|\r/g, " ").trim();
    const escaped = cleaned.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const handleExportCSV = () => {
    if (!hasExportableData) {
      toast.error("Nenhuma despesa para exportar agora.");
      return;
    }

    const header = ["Categoria", "Descricao", "Forma de pagamento", "Data", "Valor"];
    const rows = filteredExpenses.map((expense) => [
      expense.category,
      expense.description,
      expense.paymentMethod,
      expense.date,
      expense.value,
    ]);

    const csvContent = [header, ...rows].map((row) => row.map(sanitizeForCsv).join(";")).join("\n");
    const filename = `despesas-${new Date().toISOString().slice(0, 10)}.csv`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("CSV gerado com os filtros atuais.");
  };

  const escapeHtml = (value) => {
    const raw = value === null || value === undefined ? "" : String(value);
    return raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  // Gera um layout imprimivel para permitir salvar em PDF via navegador.
  const handleExportPDF = () => {
    if (!hasExportableData) {
      toast.error("Nenhuma despesa para exportar agora.");
      return;
    }

    const tableRows = filteredExpenses
      .map(
        (expense) => `
          <tr>
            <td>${escapeHtml(expense.category)}</td>
            <td>${escapeHtml(expense.description)}</td>
            <td>${escapeHtml(expense.paymentMethod)}</td>
            <td>${escapeHtml(expense.date)}</td>
            <td>${escapeHtml(expense.value)}</td>
          </tr>`,
      )
      .join("");

    const styles = `
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
        h1 { font-size: 20px; margin: 0 0 8px 0; }
        p { margin: 0 0 16px 0; color: #475569; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { padding: 8px 10px; border: 1px solid #e2e8f0; text-align: left; }
        th { background: #f8fafc; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11px; }
        tbody tr:nth-child(even) { background: #f8fafc; }
      </style>
    `;

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Despesas - exportacao PDF</title>
          ${styles}
        </head>
        <body>
          <h1>Despesas exportadas</h1>
          <p>Gerado em ${escapeHtml(new Date().toLocaleString())} · ${filteredExpenses.length} registro(s)</p>
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Descricao</th>
                <th>Forma de pagamento</th>
                <th>Data</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast.error("Habilite pop-ups para exportar em PDF.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Despesas</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Controle de gastos fixos e variaveis. Conecte esta tela ao Supabase para carregar dados reais.
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Resumo do mes</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Atualize os filtros para refinar a visualizacao.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-temaSky hover:text-temaSky dark:border-gray-700 dark:text-gray-300 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
              aria-expanded={filtersOpen}
            >
              <LucideIcon name="Filter" size={16} className="text-gray-500 dark:text-gray-400" />
              {filtersOpen ? "Fechar filtros" : "Filtros"}
              {filtersApplied && !filtersOpen && (
                <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-temaSky dark:bg-temaEmerald" aria-hidden="true" />
              )}
            </button>
            {filtersApplied && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-temaSky hover:text-temaSky dark:border-gray-700 dark:text-gray-300 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
              >
                <LucideIcon name="Eraser" size={16} className="text-gray-500 dark:text-gray-400" />
                Limpar
              </button>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                disabled={!hasExportableData}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-temaSky hover:text-temaSky disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
              >
                <LucideIcon name="FileDown" size={16} className="text-gray-500 dark:text-gray-400" />
                Exportar CSV
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={!hasExportableData}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-temaSky hover:text-temaSky disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
              >
                <LucideIcon name="FileText" size={16} className="text-gray-500 dark:text-gray-400" />
                Exportar PDF
              </button>
            </div>
            <Link
              to="/despesas/nova"
              className="inline-flex items-center gap-2 rounded-md border border-transparent bg-temaSky px-4 py-2 text-sm font-medium text-white transition hover:bg-temaSky-dark dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark"
            >
              <LucideIcon name="Plus" size={16} className="text-white" />
              Nova despesa
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Resumo rapido</h3>

          {isLoading && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Carregando resumo...</p>
          )}

          {showAuthNotice && !isLoading && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Entre na sua conta para visualizar o consolidado.
            </p>
          )}

          {!isLoading && !showAuthNotice && state.error && (
            <p className="text-xs text-rose-600 dark:text-rose-300">
              Nao foi possivel carregar o resumo agora.
            </p>
          )}

          {!isLoading && !showAuthNotice && !state.error && !summaryInfo.hasItems && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Nenhuma despesa encontrada com os filtros atuais.
            </p>
          )}

          {!isLoading && !showAuthNotice && !state.error && summaryInfo.hasItems && (
            <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Total gasto</dt>
                <dd className="mt-1 text-sm font-semibold text-rose-600 dark:text-rose-400">
                  {summaryInfo.totalDisplay}
                </dd>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Ticket medio</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {summaryInfo.averageDisplay}
                </dd>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Categorias</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {summaryInfo.categoriesCount}
                </dd>
              </div>
              {summaryInfo.lastExpenseInfo && (
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                  <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Ultima despesa</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {summaryInfo.lastExpenseInfo.date}
                  </dd>
                  <dd className="text-xs text-gray-500 dark:text-gray-400">
                    {summaryInfo.lastExpenseInfo.description}
                  </dd>
                  <dd className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {summaryInfo.lastExpenseInfo.value}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {filtersOpen && (
          <form
            className="grid gap-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-900/60"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                Categoria
                <select
                  name="category"
                  value={filters.category}
                  onChange={handleFilterInputChange}
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
                Forma de pagamento
                <select
                  name="paymentMethod"
                  value={filters.paymentMethod}
                  onChange={handleFilterInputChange}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                >
                  <option value="all">Todas</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300 md:col-span-2">
                Buscar
                <input
                  type="search"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterInputChange}
                  placeholder="Procure por descricao, categoria ou forma de pagamento"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                Data inicial
                <input
                  type="date"
                  name="dateFrom"
                  value={filters.dateFrom}
                  onChange={handleFilterInputChange}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                Data final
                <input
                  type="date"
                  name="dateTo"
                  value={filters.dateTo}
                  onChange={handleFilterInputChange}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                Valor minimo (R$)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="minValue"
                  value={filters.minValue}
                  onChange={handleFilterInputChange}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                Valor maximo (R$)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="maxValue"
                  value={filters.maxValue}
                  onChange={handleFilterInputChange}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Ajuste os campos para refinar as despesas exibidas.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearFilters}
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
          </form>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summaryCards.map((card) => (
            <div
              key={card.title}
              className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-950"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {card.title}
              </p>
              <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">{card.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{card.helper}</p>
            </div>
          ))}
        </div>

        {!isLoading && !showAuthNotice && !state.error && hasExportableData && (
          <div className="grid gap-3">
            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Categorias
                </p>
                <span className="text-[11px] text-gray-400">Top 6</span>
              </div>
              <div className="mt-2 h-[10.5rem]">
                {categoryBarOption ? (
                  <ReactECharts option={categoryBarOption} style={{ height: "100%", width: "100%" }} opts={{ renderer: "svg" }} />
                ) : (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Sem dados de categoria.</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Ticket medio
                </p>
                <span className="text-[11px] text-gray-400">Ultimos lancamentos</span>
              </div>
              <div className="mt-2 h-[10.5rem]">
                {ticketBarOption ? (
                  <ReactECharts option={ticketBarOption} style={{ height: "100%", width: "100%" }} opts={{ renderer: "svg" }} />
                ) : (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Cadastre mais despesas para ver o grafico.</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Evolucao
                </p>
                <span className="text-[11px] text-gray-400">Linha</span>
              </div>
              <div className="mt-2 h-[10.5rem]">
                {evolutionLineOption ? (
                  <ReactECharts option={evolutionLineOption} style={{ height: "100%", width: "100%" }} opts={{ renderer: "svg" }} />
                ) : (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Nenhuma evolucao para exibir.</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/80">
              <tr className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Descricao</th>
                <th className="px-4 py-3 font-medium">Forma de pagamento</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Carregando despesas...
                  </td>
                </tr>
              )}

              {showAuthNotice && !isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Entre na sua conta para visualizar as despesas.
                  </td>
                </tr>
              )}

              {!isLoading && !showAuthNotice && state.error && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-rose-500 dark:text-rose-400">
                    Nao foi possivel carregar as despesas. Tente novamente em instantes.
                  </td>
                </tr>
              )}

              {!isLoading && !showAuthNotice && !state.error && filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    {filtersApplied
                      ? "Nenhuma despesa corresponde aos filtros atuais."
                      : "Nenhuma despesa encontrada."}
                  </td>
                </tr>
              )}

              {!isLoading && !showAuthNotice && !state.error && filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/60">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{expense.category}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    <div className="space-y-1">
                      <p>{expense.description}</p>
                      {expense.installmentLabel && (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                          {expense.installmentLabel}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{expense.paymentMethod}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{expense.date}</td>
                  <td className="px-4 py-3 font-semibold text-rose-600 dark:text-rose-400">{expense.value}</td>
                  <td className="px-4 py-3">
                    <RecordActions
                      onView={() => handleView(expense.id)}
                      onEdit={() => handleEdit(expense.raw)}
                      onDelete={() => handleDelete(expense.raw)}
                      disabled={deletingId === expense.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedExpense && (
          <div className="mt-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Detalhes da despesa selecionada
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Visualize as informacoes completas e acesse as acoes acima.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExpenseId(null)}
                className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-400 hover:text-gray-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-100"
              >
                Fechar
              </button>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Categoria</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {selectedExpense.category}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Valor</dt>
                <dd className="mt-1 text-sm font-semibold text-rose-600 dark:text-rose-400">
                  {selectedExpense.value}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Data</dt>
                <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">{selectedExpense.date}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Pagamento</dt>
                <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {selectedExpense.paymentMethod}
                </dd>
              </div>
              {selectedExpense.raw?.payment_method === "cartao" && selectedExpense.raw?.card?.name && (
                <div>
                  <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Cartao</dt>
                  <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">{selectedExpense.raw.card.name}</dd>
                </div>
              )}
              <div className="sm:col-span-2 lg:col-span-4">
                <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Descricao</dt>
                <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {selectedExpense.raw.description?.trim() || "—"}
                </dd>
              </div>
              {selectedExpense.installmentLabel && (
                <div>
                  <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Parcelamento</dt>
                  <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">{selectedExpense.installmentLabel}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </section>
    </div>
  );
}
