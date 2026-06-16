import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import { createRevenue, updateRevenue } from "../services/revenues.js";
import { normalizeDateForSupabase, parseDecimalInput } from "../utils/forms.js";
import { REVENUE_CATEGORIES } from "../utils/constants.js";
import { toDateInputValue } from "../utils/formatters.js";
import { composeRevenueDescription, parseRevenueDescription } from "../utils/revenues.js";

const INITIAL_STATE = {
  value: "",
  source: "",
  date: "",
  description: "",
  category: "",
};

export default function RevenueCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const editingRecord = location.state?.record ?? null;
  const isEditing = Boolean(editingRecord?.id);
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (!editingRecord) {
      setFormData(INITIAL_STATE);
      return;
    }

    const { origin, notes } = parseRevenueDescription(editingRecord.description || "");
    setFormData({
      value:
        editingRecord.value !== null && editingRecord.value !== undefined
          ? String(editingRecord.value)
          : "",
      source: origin ?? "",
      date: toDateInputValue(editingRecord.date) ?? "",
      description: notes ?? "",
      category: editingRecord.category ?? "",
    });
  }, [editingRecord]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const parsedValue = parseDecimalInput(formData.value);
      const normalizedDate = normalizeDateForSupabase(formData.date);
      const trimmedSource = formData.source?.trim();
      const finalCategory = (formData.category || "outros").trim();

      if (parsedValue === null) {
        throw new Error("Informe um valor valido.");
      }

      if (!normalizedDate) {
        throw new Error("Informe uma data valida.");
      }

      if (!trimmedSource) {
        throw new Error("Informe a origem da renda.");
      }

      const normalizedValue = Number(parsedValue.toFixed(2));
      const details = formData.description?.trim();
      const combinedDescription = composeRevenueDescription({
        origin: trimmedSource,
        notes: details,
      });

      const payload = {
        user_id: user.id,
        value: normalizedValue,
        category: finalCategory,
        date: normalizedDate.date,
        description: combinedDescription,
      };

      if (isEditing) {
        await updateRevenue(editingRecord.id, payload);
        toast.success("Renda atualizada com sucesso!");
      } else {
        await createRevenue(payload);
        toast.success("Renda cadastrada com sucesso!");
      }
      navigate("/rendas", { replace: true });
    } catch (error) {
      console.error(error);
      toast.error(error.message || error.details || "Nao foi possivel cadastrar a renda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
          {isEditing ? "Editar renda" : "Cadastrar renda"}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {isEditing
            ? "Atualize as informacoes da renda e salve as alteracoes."
            : "Registre entradas financeiras fixas ou variaveis para acompanhar o fluxo de caixa."}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Valor (R$)
            <input
              name="value"
              type="number"
              min="0"
              step="0.01"
              required
              value={formData.value}
              onChange={handleChange}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Data
            <input
              name="date"
              type="date"
              required
              value={formData.date}
              onChange={handleChange}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Categoria
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            >
              <option value="">Selecione...</option>
              {REVENUE_CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Origem
            <input
              name="source"
              type="text"
              required
              value={formData.source}
              onChange={handleChange}
              placeholder="Empresa, cliente, contrato..."
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            />
          </label>
        </div>

        <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          Descricao
          <textarea
            name="description"
            rows={3}
            value={formData.description}
            onChange={handleChange}
            placeholder="Detalhes adicionais (opcional)."
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
          />
        </label>

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
            {loading ? (isEditing ? "Atualizando..." : "Salvando...") : isEditing ? "Atualizar renda" : "Registrar renda"}
          </button>
        </div>
      </form>
    </div>
  );
}
