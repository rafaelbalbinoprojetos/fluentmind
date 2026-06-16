import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import { deleteOvertime, listOvertime } from "../services/overtime.js";
import RecordActions from "../components/RecordActions.jsx";
import { formatCurrency, formatDate, formatDateTime } from "../utils/formatters.js";
import { minutesToHours } from "../utils/overtime.js";

function parseDateTimeValue(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function ExtraPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState({
    loading: true,
    data: [],
    error: null,
  });
  const [selectedOvertimeId, setSelectedOvertimeId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let ignore = false;

    if (authLoading) {
      return undefined;
    }

    if (!user) {
      setState({ loading: false, data: [], error: null });
      setSelectedOvertimeId(null);
      return undefined;
    }

    async function fetchOvertime() {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const items = await listOvertime({ userId: user.id });
        if (ignore) return;
        setState({ loading: false, data: items ?? [], error: null });
      } catch (error) {
        console.error(error);
        if (ignore) return;
        setState({ loading: false, data: [], error });
      }
    }

    fetchOvertime();

    return () => {
      ignore = true;
    };
  }, [authLoading, user, user?.id]);

  const { records, totalMinutes, totalValue } = useMemo(() => {
    const items = state.data
      .map((entry) => {
        const start = parseDateTimeValue(entry.start_time);
        const end = parseDateTimeValue(entry.end_time);
        const durationMinutes =
          start && end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60))) : 0;
        const hourlyRate = Number(entry.hourly_rate);
        const total = Number(entry.total_value);
        const percentage = Number(entry.overtime_percentage);

        return {
          id: entry.id,
          raw: entry,
          start,
          end,
          formattedStart: formatDateTime(entry.start_time),
          formattedEnd: formatDateTime(entry.end_time),
          durationMinutes,
          formattedDuration: minutesToHours(durationMinutes),
          formattedHourlyRate: Number.isFinite(hourlyRate) ? formatCurrency(hourlyRate) : "—",
          formattedPercentage: Number.isFinite(percentage)
            ? `${Math.round(percentage * 100)}%`
            : "—",
          formattedTotal: Number.isFinite(total) ? formatCurrency(total) : "—",
          numericTotal: Number.isFinite(total) ? total : 0,
          paymentDate: formatDate(entry.payment_date),
          hourlyRateValue: Number.isFinite(hourlyRate) ? hourlyRate : null,
          percentageValue: Number.isFinite(percentage) ? percentage : null,
        };
      })
      .sort((a, b) => {
        if (!a.start && !b.start) return 0;
        if (!a.start) return 1;
        if (!b.start) return -1;
        return b.start.getTime() - a.start.getTime();
      });

    const minutesSum = items.reduce((sum, item) => sum + (Number.isFinite(item.durationMinutes) ? item.durationMinutes : 0), 0);
    const valueSum = items.reduce((sum, item) => sum + item.numericTotal, 0);

    return {
      records: items,
      totalMinutes: minutesSum,
      totalValue: valueSum,
    };
  }, [state.data]);

  const showAuthNotice = !authLoading && !user;
  const isLoading = authLoading || state.loading;
  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedOvertimeId) ?? null,
    [records, selectedOvertimeId],
  );

  const handleView = (id) => {
    setSelectedOvertimeId((current) => (current === id ? null : id));
  };

  const handleEdit = (record) => {
    navigate("/extra/novo", { state: { record } });
  };

  const handleDelete = async (record) => {
    if (!record?.id) return;
    const confirmed = window.confirm("Tem certeza que deseja excluir este registro de hora extra?");
    if (!confirmed) return;

    setDeletingId(record.id);
    try {
      await deleteOvertime(record.id);
      setState((prev) => ({
        ...prev,
        data: prev.data.filter((item) => item.id !== record.id),
      }));
      setSelectedOvertimeId((current) => (current === record.id ? null : current));
      toast.success("Registro de hora extra excluido com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Nao foi possivel excluir o registro.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Horas extras</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Centralize o acompanhamento de horas adicionais por equipe e identifique padroes.
          </p>
        </div>
        <Link
          to="/extra/novo"
          className="inline-flex items-center rounded-md border border-transparent bg-temaSky px-4 py-2 text-sm font-medium text-white transition hover:bg-temaSky-dark dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark"
        >
          Registrar horas extras
        </Link>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Resumo semanal</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Consolidado das jornadas extras registradas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
            <span className="rounded-full bg-temaSky/10 px-3 py-1 text-temaSky">
              Registros: {records.length}
            </span>
            <span className="rounded-full bg-temaEmerald/10 px-3 py-1 text-temaEmerald">
              Total de horas: {minutesToHours(totalMinutes)}
            </span>
            <span className="rounded-full bg-purple-500/15 px-3 py-1 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300">
              Total pago: {formatCurrency(totalValue)}
            </span>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/80">
              <tr className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="px-4 py-3 font-medium">Inicio</th>
                <th className="px-4 py-3 font-medium">Fim</th>
                <th className="px-4 py-3 font-medium">Duracao</th>
                <th className="px-4 py-3 font-medium">Valor hora</th>
                <th className="px-4 py-3 font-medium">Percentual</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Pagamento</th>
                <th className="px-4 py-3 font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Carregando horas extras...
                  </td>
                </tr>
              )}

              {showAuthNotice && !isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Entre na sua conta para visualizar as horas extras registradas.
                  </td>
                </tr>
              )}

              {!isLoading && !showAuthNotice && state.error && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-rose-500 dark:text-rose-400">
                    Nao foi possivel carregar as horas extras. Tente novamente em instantes.
                  </td>
                </tr>
              )}

              {!isLoading && !showAuthNotice && !state.error && records.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhum registro de hora extra encontrado.
                  </td>
                </tr>
              )}

              {!isLoading && !showAuthNotice && !state.error && records.map((record) => (
                <tr
                  key={record.id}
                  className={`hover:bg-gray-50/70 dark:hover:bg-gray-800/60 ${
                    selectedOvertimeId === record.id
                      ? "bg-temaSky/10 dark:bg-temaEmerald/10"
                      : ""
                  }`}
                >
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{record.formattedStart}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{record.formattedEnd}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    {record.formattedDuration}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{record.formattedHourlyRate}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{record.formattedPercentage}</td>
                  <td className="px-4 py-3 font-semibold text-temaSky dark:text-temaEmerald">
                    {record.formattedTotal}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{record.paymentDate}</td>
                  <td className="px-4 py-3">
                    <RecordActions
                      onView={() => handleView(record.id)}
                      onEdit={() => handleEdit(record.raw)}
                      onDelete={() => handleDelete(record.raw)}
                      disabled={deletingId === record.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedRecord && (
          <div className="mt-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Detalhes do registro selecionado
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Revise os horarios e valores antes de editar ou remover.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOvertimeId(null)}
                className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-400 hover:text-gray-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-100"
              >
                Fechar
              </button>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Inicio</dt>
                <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">{selectedRecord.formattedStart}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Fim</dt>
                <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">{selectedRecord.formattedEnd}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Duracao</dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {selectedRecord.formattedDuration}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Valor hora</dt>
                <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {selectedRecord.formattedHourlyRate}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Percentual</dt>
                <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {selectedRecord.formattedPercentage}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Total</dt>
                <dd className="mt-1 text-sm font-semibold text-temaSky dark:text-temaEmerald">
                  {selectedRecord.formattedTotal}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">Pagamento</dt>
                <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">{selectedRecord.paymentDate}</dd>
              </div>
            </dl>
          </div>
        )}
      </section>

    </div>
  );
}
