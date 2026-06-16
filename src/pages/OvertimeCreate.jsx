import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import { createOvertime, updateOvertime } from "../services/overtime.js";
import { OVERTIME_PERCENTAGES } from "../utils/constants.js";
import {
  calculateOvertimeValue,
  ensureEndDate,
  minutesToHours,
} from "../utils/overtime.js";
import { ensureFiniteNumber, normalizeDateForSupabase, parseDecimalInput } from "../utils/forms.js";
import { toDateInputValue, toDateTimeLocalValue } from "../utils/formatters.js";

const INITIAL_STATE = {
  start_time: "",
  end_time: "",
  hourly_rate: "",
  overtime_percentage: OVERTIME_PERCENTAGES[0].value,
  payment_date: "",
};

export default function OvertimeCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const editingRecord = location.state?.record ?? null;
  const isEditing = Boolean(editingRecord?.id);
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!editingRecord) {
      setFormData(INITIAL_STATE);
      return;
    }

    setFormData({
      start_time: toDateTimeLocalValue(editingRecord.start_time) ?? "",
      end_time: toDateTimeLocalValue(editingRecord.end_time) ?? "",
      hourly_rate:
        editingRecord.hourly_rate !== null && editingRecord.hourly_rate !== undefined
          ? String(editingRecord.hourly_rate)
          : "",
      overtime_percentage:
        editingRecord.overtime_percentage !== null && editingRecord.overtime_percentage !== undefined
          ? String(editingRecord.overtime_percentage)
          : OVERTIME_PERCENTAGES[0].value,
      payment_date: toDateInputValue(editingRecord.payment_date) ?? "",
    });
  }, [editingRecord]);

  const parsedStart = useMemo(
    () => (formData.start_time ? new Date(formData.start_time) : null),
    [formData.start_time],
  );
  const parsedEnd = useMemo(
    () => (formData.end_time ? new Date(formData.end_time) : null),
    [formData.end_time],
  );

  const hourlyRateNumber = useMemo(
    () => parseDecimalInput(formData.hourly_rate) ?? 0,
    [formData.hourly_rate],
  );

  const overtimePercentageNumber = useMemo(
    () => parseDecimalInput(formData.overtime_percentage) ?? 0,
    [formData.overtime_percentage],
  );

  const computed = useMemo(
    () =>
      calculateOvertimeValue({
        start: parsedStart,
        end: parsedEnd,
        hourlyRate: hourlyRateNumber,
        overtimePercentage: overtimePercentageNumber,
      }),
    [parsedStart, parsedEnd, hourlyRateNumber, overtimePercentageNumber],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) return;

    const { start: startTime, end: endTime } = ensureEndDate(parsedStart, parsedEnd);
    if (!startTime || !endTime) {
      toast.error("Informe inicio e fim da jornada.");
      return;
    }

    setLoading(true);
    try {
      const parsedHourlyRate = parseDecimalInput(formData.hourly_rate);
      const parsedPercentage = parseDecimalInput(formData.overtime_percentage);
      const normalizedPaymentDate = normalizeDateForSupabase(formData.payment_date);

      if (parsedHourlyRate === null) {
        throw new Error("Valor hora invalido.");
      }

      if (parsedPercentage === null) {
        throw new Error("Percentual invalido.");
      }

      if (!normalizedPaymentDate) {
        throw new Error("Informe uma data de pagamento valida.");
      }

      const payload = {
        user_id: user.id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        hourly_rate: parsedHourlyRate,
        overtime_percentage: parsedPercentage,
        payment_date: normalizedPaymentDate.date,
        total_value: ensureFiniteNumber(Number(computed.totalValue.toFixed(2)), 0),
      };

      if (isEditing) {
        await updateOvertime(editingRecord.id, payload);
        toast.success("Registro de horas extras atualizado com sucesso!");
      } else {
        await createOvertime(payload);
        toast.success("Horas extras registradas com sucesso!");
      }

      navigate("/extra", { replace: true });
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Nao foi possivel salvar as horas extras.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!formData.payment_date && formData.end_time) {
      setFormData((prev) => ({
        ...prev,
        payment_date: prev.payment_date || formData.end_time.slice(0, 10),
      }));
    }
  }, [formData.end_time, formData.payment_date]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
          {isEditing ? "Editar horas extras" : "Registrar horas extras"}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {isEditing
            ? "Atualize os horarios e valores registrados para o plantao selecionado."
            : "O valor total sera calculado automaticamente considerando adicional de 30% entre 22h e 06h."}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Inicio
            <input
              name="start_time"
              type="datetime-local"
              required
              value={formData.start_time}
              onChange={handleChange}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Fim
            <input
              name="end_time"
              type="datetime-local"
              required
              value={formData.end_time}
              onChange={handleChange}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Valor hora (R$)
            <input
              name="hourly_rate"
              type="number"
              min="0"
              step="0.01"
              required
              value={formData.hourly_rate}
              onChange={handleChange}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Percentual da hora extra
            <select
              name="overtime_percentage"
              required
              value={formData.overtime_percentage}
              onChange={handleChange}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            >
              {OVERTIME_PERCENTAGES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Data do pagamento
            <input
              name="payment_date"
              type="date"
              required
              value={formData.payment_date}
              onChange={handleChange}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            />
          </label>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200">
          <div className="grid gap-3 md:grid-cols-2">
            <Stat label="Tempo total" value={minutesToHours(computed.totalMinutes)} />
            <Stat label="Tempo noturno (22h-06h)" value={minutesToHours(computed.nightMinutes)} />
            <Stat label="Valor base" value={formatCurrency(computed.baseValue)} />
            <Stat label="Adicional noturno (30%)" value={formatCurrency(computed.nightExtra)} />
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-temaSky/10 px-4 py-3 text-sm font-semibold text-temaSky dark:bg-temaEmerald/10 dark:text-temaEmerald">
            <span>Total estimado</span>
            <span>{formatCurrency(computed.totalValue)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-400 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg bg-temaSky px-4 py-2 text-sm font-semibold text-white transition hover:bg-temaSky-dark disabled:cursor-not-allowed disabled:opacity-60 dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark"
          >
            {loading
              ? isEditing
                ? "Atualizando..."
                : "Calculando..."
              : isEditing
              ? "Atualizar registro"
              : "Registrar horas extras"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

function formatCurrency(value) {
  const number = Number.isFinite(value) ? value : 0;
  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}
