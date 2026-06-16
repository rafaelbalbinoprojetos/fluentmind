import React, { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import { deleteRevenue, listRevenues } from "../services/revenues.js";
import RecordActions from "../components/RecordActions.jsx";
import { formatCurrency, formatDate } from "../utils/formatters.js";
import { REVENUE_CATEGORIES } from "../utils/constants.js";
import { parseRevenueDescription } from "../utils/revenues.js";

const CATEGORY_LABELS = Object.fromEntries(
  REVENUE_CATEGORIES.map((category) => [category.value, category.label]),
);

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const str = String(value).trim();
  if (!str) return null;

  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(str) ? `${str}T00:00:00Z` : str;
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? null : date;
}

const DEFAULT_REVENUE_FILTERS = {
  category: "all",
  search: "",
  dateFrom: "",
  dateTo: "",
  minValue: "",
  maxValue: "",
};

export default function IncomePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState({
    loading: true,
    data: [],
    error: null,
  });
  const [selectedRevenueId, setSelectedRevenueId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_REVENUE_FILTERS }));

  useEffect(() => {
    let ignore = false;

    if (authLoading) {
      return undefined;
    }

    if (!user) {
      setState({ loading: false, data: [], error: null });
      setSelectedRevenueId(null);
      return undefined;
    }

    async function fetchRevenues() {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const items = await listRevenues({ userId: user.id });
        if (ignore) return;
        setState({ loading: false, data: items ?? [], error: null });
      } catch (error) {
        console.error(error);
        if (ignore) return;
        setState({ loading: false, data: [], error });
      }
    }

    fetchRevenues();

    return () => {
      ignore = true;
    };
  }, [authLoading, user, user?.id]);

  const baseRevenues = useMemo(
    () =>
      state.data
        .map((revenue) => {
          const numericValue = Number(revenue.value);
          const parsedValue = Number.isFinite(numericValue) ? numericValue : 0;
          const { origin, notes } = parseRevenueDescription(revenue.description || "");
          const parsedDate = parseDateValue(revenue.date);

          return {
            id: revenue.id,
            raw: revenue,
            category: CATEGORY_LABELS[revenue.category] ?? revenue.category ?? "Sem categoria",
            origin: origin || revenue.description?.trim() || "Origem nao informada",
            notes: notes,
            formattedDate: formatDate(revenue.date),
            rawDate: parsedDate,
            formattedValue: formatCurrency(parsedValue),
            numericValue: parsedValue,
          };
        })
        .sort((a, b) => {
          if (!a.rawDate && !b.rawDate) return 0;
          if (!a.rawDate) return 1;
          if (!b.rawDate) return -1;
          return b.rawDate.getTime() - a.rawDate.getTime();
        }),
    [state.data],
  );

  const parseFilterNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, numeric) : null;
  };

  const filteredRevenues = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    const fromDate = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
    const toDate = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null;
    const minValue = parseFilterNumber(filters.minValue);
    const maxValue = parseFilterNumber(filters.maxValue);

    return baseRevenues.filter((item) => {
      const raw = item.raw ?? {};

      if (filters.category !== "all" && raw.category !== filters.category) {
        return false;
      }

      if (normalizedSearch) {
        const haystack = `${item.origin} ${item.category} ${item.notes ?? ""}`
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
        const revenueDate = raw.date ? parseDateValue(raw.date) : null;
        if (!revenueDate || Number.isNaN(revenueDate.getTime())) {
          return false;
        }
        if (fromDate && revenueDate < fromDate) return false;
        if (toDate && revenueDate > toDate) return false;
      }

      if (minValue !== null && (item.numericValue ?? 0) < minValue) {
        return false;
      }
      if (maxValue !== null && (item.numericValue ?? 0) > maxValue) {
        return false;
      }

      return true;
    });
  }, [baseRevenues, filters]);

  const filtersApplied = useMemo(() => {
    return (
      filters.category !== "all" ||
      filters.search.trim() !== "" ||
      filters.dateFrom !== "" ||
      filters.dateTo !== "" ||
      filters.minValue !== "" ||
      filters.maxValue !== ""
    );
  }, [filters]);

  const { revenues, totalValue, uniqueCategories, lastIncome } = useMemo(() => {
    const items = filteredRevenues;
    const total = items.reduce((sum, item) => sum + (Number.isFinite(item.numericValue) ? item.numericValue : 0), 0);
    const categories = new Set(items.map((item) => item.category));
    const last = items.find((item) => item.rawDate) ?? items[0] ?? null;

    return {
      revenues: items,
      totalValue: total,
      uniqueCategories: categories.size,
      lastIncome: last,
    };
  }, [filteredRevenues]);

  const showAuthNotice = !authLoading && !user;
  const isLoading = authLoading || state.loading;
  const averageValue =
    revenues.length > 0 ? formatCurrency(totalValue / revenues.length) : formatCurrency(0);

  const selectedRevenue = useMemo(
    () => filteredRevenues.find((item) => item.id === selectedRevenueId) ?? null,
    [filteredRevenues, selectedRevenueId],
  );

  const handleView = (id) => {
    setSelectedRevenueId((current) => (current === id ? null : id));
  };

  const handleEdit = (record) => {
    navigate("/rendas/nova", { state: { record } });
  };

  const handleDelete = async (record) => {
    if (!record?.id) return;
    const confirmed = window.confirm("Tem certeza que deseja excluir esta renda?");
    if (!confirmed) return;

    setDeletingId(record.id);
    try {
      await deleteRevenue(record.id);
      setState((prev) => ({
        ...prev,
        data: prev.data.filter((item) => item.id !== record.id),
      }));
      setSelectedRevenueId((current) => (current === record.id ? null : current));
      toast.success("Renda excluida com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Nao foi possivel excluir a renda.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleFilterInputChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleClearFilters = () => {
    setFilters({ ...DEFAULT_REVENUE_FILTERS });
  };

  const hasCharts = !isLoading && !showAuthNotice && !state.error && revenues.length > 0;
  const hasExportableData = !isLoading && !showAuthNotice && !state.error && revenues.length > 0;
  const hasBaseRevenues = baseRevenues.length > 0;
  const noResultsWithFilters = hasBaseRevenues && revenues.length === 0 && filtersApplied;

  const sanitizeForCsv = (value) => {
    if (value === null || value === undefined) return '""';
    const cleaned = String(value).replace(/\r?\n|\r/g, " ").trim();
    const escaped = cleaned.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const handleExportCSV = () => {
    if (!hasExportableData) {
      toast.error("Nenhuma renda para exportar agora.");
      return;
    }

    const header = ["Categoria", "Origem", "Notas", "Data", "Valor"];
    const rows = revenues.map((item) => [
      item.category,
      item.origin,
      item.notes || "",
      item.formattedDate,
      item.formattedValue,
    ]);

    const csvContent = [header, ...rows].map((row) => row.map(sanitizeForCsv).join(";")).join("\n");
    const filename = `rendas-${new Date().toISOString().slice(0, 10)}.csv`;

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

  const handleExportPDF = () => {
    if (!hasExportableData) {
      toast.error("Nenhuma renda para exportar agora.");
      return;
    }

    const tableRows = revenues
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.category)}</td>
            <td>${escapeHtml(item.origin)}</td>
            <td>${escapeHtml(item.notes || "")}</td>
            <td>${escapeHtml(item.formattedDate)}</td>
            <td>${escapeHtml(item.formattedValue)}</td>
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
          <title>Rendas - exportacao PDF</title>
          ${styles}
        </head>
        <body>
          <h1>Rendas exportadas</h1>
          <p>Gerado em ${escapeHtml(new Date().toLocaleString())} · ${revenues.length} registro(s)</p>
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Origem</th>
                <th>Notas</th>
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

  const pieOption = useMemo(() => {
    if (!hasCharts) return null;
    const totals = new Map();
    revenues.forEach((item) => {
      const value = Math.max(0, item.numericValue ?? 0);
      if (!Number.isFinite(value) || value === 0) return;
      totals.set(item.category, (totals.get(item.category) ?? 0) + value);
    });

    const data = Array.from(totals.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .filter((entry) => entry.value > 0);

    if (!data.length) return null;

    return {
      tooltip: {
        trigger: "item",
        formatter: "{b}: R$ {c} ({d}%)",
      },
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
          label: { show: false },
          data,
        },
      ],
      animation: false,
    };
  }, [hasCharts, revenues]);

  const monthlySeries = useMemo(() => {
    if (!hasCharts) return { labels: [], totals: [], averages: [] };
    const byMonth = new Map();

    revenues.forEach((item) => {
      if (!item.rawDate || Number.isNaN(item.rawDate.getTime())) return;
      const key = item.rawDate.toISOString().slice(0, 7); // YYYY-MM
      const entry = byMonth.get(key) ?? { total: 0, count: 0 };
      const value = Math.max(0, item.numericValue ?? 0);
      if (!Number.isFinite(value) || value === 0) return;
      entry.total += value;
      entry.count += 1;
      byMonth.set(key, entry);
    });

    const sorted = Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const labels = sorted.map(([month]) => {
      const date = new Date(`${month}-01T00:00:00`);
      return Number.isNaN(date.getTime())
        ? month
        : date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
    });
    const totals = [];
    let running = 0;
    const averages = [];

    sorted.forEach(([, { total, count }]) => {
      running += total;
      totals.push(Number(running.toFixed(2)));
      averages.push(Number((total / Math.max(1, count)).toFixed(2)));
    });

    return { labels, totals, averages };
  }, [hasCharts, revenues]);

  const cumulativeLineOption = useMemo(() => {
    if (!hasCharts || monthlySeries.labels.length === 0) return null;
    return {
      color: ["#0ea5e9"],
      grid: { top: 8, bottom: 20, left: 12, right: 8 },
      xAxis: {
        type: "category",
        data: monthlySeries.labels,
        boundaryGap: false,
        axisLabel: { color: "#475569", fontSize: 10 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#e2e8f0" } },
      },
      yAxis: { type: "value", show: false },
      series: [
        {
          type: "line",
          smooth: true,
          data: monthlySeries.totals,
          showSymbol: false,
          areaStyle: { color: "rgba(14,165,233,0.15)" },
          lineStyle: { width: 2 },
        },
      ],
      tooltip: {
        trigger: "axis",
        formatter: (params) => {
          const item = params[0];
          return `${item.axisValue}<br/>Acumulado: R$ ${Number(item.value ?? 0).toFixed(2)}`;
        },
      },
      animation: false,
    };
  }, [hasCharts, monthlySeries]);

  const ticketBarOption = useMemo(() => {
    if (!hasCharts || monthlySeries.labels.length === 0) return null;
    return {
      color: ["#10b981"],
      grid: { top: 8, bottom: 20, left: 8, right: 8 },
      xAxis: {
        type: "category",
        data: monthlySeries.labels,
        axisLabel: { color: "#475569", fontSize: 10 },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      yAxis: { type: "value", show: false },
      series: [
        {
          type: "bar",
          data: monthlySeries.averages,
          barWidth: "55%",
          itemStyle: { borderRadius: [6, 6, 6, 6] },
          label: {
            show: true,
            position: "top",
            color: "#0f172a",
            fontSize: 10,
            formatter: ({ value }) => `R$ ${Number(value).toFixed(0)}`,
          },
        },
      ],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const item = params[0];
          return `${item.axisValue}<br/>Ticket: R$ ${Number(item.value ?? 0).toFixed(2)}`;
        },
      },
      animation: false,
    };
  }, [hasCharts, monthlySeries]);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Rendas</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Acompanhe os canais de renda e compare com metas projetadas.
        </p>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filtros</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Use os filtros para refinar listas, cards e graficos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-temaSky hover:text-temaSky dark:border-gray-700 dark:text-gray-300 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
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
                onClick={handleClearFilters}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-temaSky hover:text-temaSky dark:border-gray-700 dark:text-gray-300 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
              >
                Limpar
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={!hasExportableData}
              className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-temaSky hover:text-temaSky disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
            >
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={!hasExportableData}
              className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-temaSky hover:text-temaSky disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:border-temaEmerald dark:hover:text-temaEmerald"
            >
              Exportar PDF
            </button>
            <Link
              to="/rendas/nova"
              className="inline-flex items-center rounded-md border border-transparent bg-temaSky px-4 py-2 text-sm font-medium text-white transition hover:bg-temaSky-dark dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark"
            >
              Registrar renda
            </Link>
          </div>
        </div>

        {filtersOpen && (
          <form
            className="mt-4 grid gap-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-900/60"
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
                  {REVENUE_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
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
                Buscar
                <input
                  type="search"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterInputChange}
                  placeholder="Procure por origem, categoria ou nota"
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
                Filtros impactam cards, lista e graficos desta pagina.
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
      </section>

      {!isLoading && !showAuthNotice && !state.error && (
        revenues.length > 0 ? (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Total recebido
              </p>
              <p className="mt-2 text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalValue)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Soma das rendas filtradas.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Ticket medio
              </p>
              <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                {averageValue}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Media das entradas visiveis.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Categorias
              </p>
              <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                {uniqueCategories}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Quantidade nas rendas filtradas.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Ultima renda
              </p>
              {lastIncome ? (
                <>
                  <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {lastIncome.formattedDate}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{lastIncome.origin}</p>
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {lastIncome.formattedValue}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Sem dados no periodo.</p>
              )}
            </div>
          </section>
        ) : (
          <p className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            {filtersApplied
              ? "Nenhuma renda corresponde aos filtros atuais."
              : "Cadastre sua primeira renda para ver o resumo."}
          </p>
        )
      )}

      {!isLoading && !showAuthNotice && !state.error && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Renda por categoria
              </p>
              <span className="text-[11px] text-gray-400">Pizza</span>
            </div>
            <div className="mt-2 h-32">
              {pieOption ? (
                <ReactECharts option={pieOption} style={{ height: "100%", width: "100%" }} opts={{ renderer: "svg" }} />
              ) : (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Sem dados suficientes.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Renda acumulada
              </p>
              <span className="text-[11px] text-gray-400">Linha</span>
            </div>
            <div className="mt-2 h-32">
              {cumulativeLineOption ? (
                <ReactECharts option={cumulativeLineOption} style={{ height: "100%", width: "100%" }} opts={{ renderer: "svg" }} />
              ) : (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Nenhum historico mensal.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Ticket medio por mes
              </p>
              <span className="text-[11px] text-gray-400">Barras</span>
            </div>
            <div className="mt-2 h-32">
              {ticketBarOption ? (
                <ReactECharts option={ticketBarOption} style={{ height: "100%", width: "100%" }} opts={{ renderer: "svg" }} />
              ) : (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Cadastre rendas mensais para ver.</p>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Resumo de entradas</h2>
            <Link
              to="/rendas/nova"
              className="inline-flex items-center rounded-md border border-transparent bg-temaSky px-4 py-2 text-sm font-medium text-white transition hover:bg-temaSky-dark dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark"
            >
              Registrar renda
            </Link>
          </div>

          <div className="mt-6">
            {isLoading && (
              <p className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                Carregando rendas...
              </p>
            )}

            {showAuthNotice && !isLoading && (
              <p className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                Entre na sua conta para visualizar as rendas cadastradas.
              </p>
            )}

            {!isLoading && !showAuthNotice && state.error && (
              <p className="rounded-lg border border-dashed border-rose-300/60 bg-rose-50 p-4 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
                Nao foi possivel carregar as rendas. Tente novamente em instantes.
              </p>
            )}

            {!isLoading && !showAuthNotice && !state.error && revenues.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                {filtersApplied
                  ? "Nenhuma renda corresponde aos filtros atuais."
                  : "Nenhuma renda cadastrada ate o momento."}
              </p>
            )}

            {!isLoading && !showAuthNotice && !state.error && revenues.length > 0 && (
              <ul className="space-y-4">
                {revenues.map((item) => (
                  <li
                    key={item.id}
                    className={`rounded-lg border p-4 transition hover:border-temaSky/60 dark:border-gray-800 dark:hover:border-temaEmerald/60 ${
                      selectedRevenueId === item.id
                        ? "border-temaSky/60 dark:border-temaEmerald/60"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-temaSky/10 px-3 py-1 text-xs font-medium text-temaSky dark:bg-temaEmerald/10 dark:text-temaEmerald">
                            {item.category}
                          </span>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {item.origin}
                          </p>
                        </div>
                        {item.notes && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
                          {item.formattedValue}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.formattedDate}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <RecordActions
                        onView={() => handleView(item.id)}
                        onEdit={() => handleEdit(item.raw)}
                        onDelete={() => handleDelete(item.raw)}
                        disabled={deletingId === item.id}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {selectedRevenue && (
              <div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Detalhes da renda selecionada
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Revise origem, notas e valores antes de editar ou excluir.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedRevenueId(null)}
                    className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-400 hover:text-gray-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-100"
                  >
                    Fechar
                  </button>
                </div>
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Categoria</dt>
                    <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {selectedRevenue.category}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Valor</dt>
                    <dd className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {selectedRevenue.formattedValue}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Data</dt>
                    <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                      {selectedRevenue.formattedDate}
                    </dd>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Origem</dt>
                    <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">{selectedRevenue.origin}</dd>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Notas adicionais</dt>
                    <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                      {selectedRevenue.notes || "Nenhuma observacao registrada."}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Resumo rapido</h2>
          {!isLoading && !showAuthNotice && !state.error && revenues.length === 0 && (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              {hasBaseRevenues
                ? "Nenhuma renda corresponde aos filtros aplicados."
                : "Cadastre sua primeira renda para visualizar o consolidado."}
            </p>
          )}

          {isLoading && (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
          )}

          {!isLoading && !showAuthNotice && !state.error && revenues.length > 0 && (
            <dl className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
                <dt>Total recebido</dt>
                <dd className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalValue)}
                </dd>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
                <dt>Ticket medio</dt>
                <dd className="font-semibold text-gray-900 dark:text-gray-100">{averageValue}</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
                <dt>Categorias</dt>
                <dd className="font-semibold text-gray-900 dark:text-gray-100">
                  {uniqueCategories}
                </dd>
              </div>
              {lastIncome && (
                <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
                  <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Ultima renda</dt>
                  <dd className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {lastIncome.formattedDate}
                  </dd>
                  <dd className="text-xs text-gray-500 dark:text-gray-400">
                    {lastIncome.origin}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {!showAuthNotice && state.error && !isLoading && (
            <p className="mt-4 text-sm text-rose-500 dark:text-rose-400">
              Nao foi possivel calcular o resumo.
            </p>
          )}

          {showAuthNotice && !isLoading && (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Entre na sua conta para visualizar o resumo de rendas.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
