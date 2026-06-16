import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import { createExpense, createExpenses, updateExpense } from "../services/expenses.js";
import { createCreditCard, listCreditCards } from "../services/creditCards.js";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "../utils/constants.js";
import { normalizeDateForSupabase, parseDecimalInput } from "../utils/forms.js";
import { toDateInputValue } from "../utils/formatters.js";

const INITIAL_STATE = {
  value: "",
  date: "",
  category: "",
  description: "",
  payment_method: "",
  card_id: "",
  installment_total: "1",
};

function addMonthsToIsoDate(isoDate, monthsToAdd) {
  const [yearRaw, monthRaw, dayRaw] = String(isoDate).split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCMonth(base.getUTCMonth() + monthsToAdd);
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, "0");
  const d = String(base.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toBillingMonth(isoDate) {
  const [yearRaw, monthRaw] = String(isoDate).split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function createInstallmentGroupId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `installment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ExpenseCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const editingRecord = location.state?.record ?? null;
  const isEditing = Boolean(editingRecord?.id);
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [quickCardForm, setQuickCardForm] = useState({
    name: "",
    brand: "",
    credit_limit: "",
    due_day: "",
    closing_day: "",
  });
  const [creatingCard, setCreatingCard] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === "payment_method" && value !== "cartao") {
      setFormData((prev) => ({ ...prev, payment_method: value, card_id: "" }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (!editingRecord) {
      setFormData(INITIAL_STATE);
      return;
    }

    setFormData({
      value:
        editingRecord.value !== null && editingRecord.value !== undefined
          ? String(editingRecord.value)
          : "",
      date: toDateInputValue(editingRecord.date) ?? "",
      category: editingRecord.category ?? "",
      description: editingRecord.description ?? "",
      payment_method: editingRecord.payment_method ?? "",
      card_id: editingRecord.card_id ?? "",
      installment_total:
        editingRecord.installment_total !== null && editingRecord.installment_total !== undefined
          ? String(editingRecord.installment_total)
          : "1",
    });
  }, [editingRecord]);

  useEffect(() => {
    let ignore = false;

    if (!user?.id) {
      setCards([]);
      setCardsLoading(false);
      return undefined;
    }

    async function fetchCards() {
      setCardsLoading(true);
      try {
        const items = await listCreditCards({ userId: user.id });
        if (ignore) return;
        setCards(items);
      } catch (error) {
        console.error(error);
        if (ignore) return;
        setCards([]);
      } finally {
        if (!ignore) {
          setCardsLoading(false);
        }
      }
    }

    fetchCards();

    return () => {
      ignore = true;
    };
  }, [user?.id]);

  const handleCreateQuickCard = async () => {
    if (!user?.id) return;
    const normalizedName = quickCardForm.name.trim();
    if (!normalizedName) {
      toast.error("Informe o nome do cartao.");
      return;
    }

    const dueDay = Number(quickCardForm.due_day);
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      toast.error("Informe um dia de vencimento valido (1 a 31).");
      return;
    }

    const parsedLimit = parseDecimalInput(quickCardForm.credit_limit);
    if (parsedLimit === null || Number(parsedLimit) <= 0) {
      toast.error("Informe um limite de credito valido.");
      return;
    }

    const closingDayRaw = quickCardForm.closing_day.trim();
    const closingDay =
      closingDayRaw === ""
        ? null
        : Number.isInteger(Number(closingDayRaw)) && Number(closingDayRaw) >= 1 && Number(closingDayRaw) <= 31
        ? Number(closingDayRaw)
        : Number.NaN;

    if (Number.isNaN(closingDay)) {
      toast.error("Informe um dia de fechamento valido (1 a 31) ou deixe em branco.");
      return;
    }

    setCreatingCard(true);
    try {
      const created = await createCreditCard({
        user_id: user.id,
        name: normalizedName,
        brand: quickCardForm.brand.trim() || null,
        credit_limit: Number(parsedLimit.toFixed(2)),
        due_day: dueDay,
        closing_day: closingDay,
      });
      setCards((prev) => [...prev, created].sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR")));
      setFormData((prev) => ({ ...prev, card_id: created.id, payment_method: "cartao" }));
      setQuickCardForm({
        name: "",
        brand: "",
        credit_limit: "",
        due_day: "",
        closing_day: "",
      });
      toast.success("Cartao criado com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Nao foi possivel criar o cartao.");
    } finally {
      setCreatingCard(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const parsedValue = parseDecimalInput(formData.value);
      const normalizedDate = normalizeDateForSupabase(formData.date);

      if (parsedValue === null) {
        throw new Error("Informe um valor valido.");
      }

      if (!normalizedDate) {
        throw new Error("Informe uma data valida.");
      }

      if (formData.payment_method === "cartao" && !formData.card_id) {
        throw new Error("Selecione um cartao para despesas no credito.");
      }

      const parsedInstallmentTotal = Number(formData.installment_total);
      const installmentTotal = Number.isInteger(parsedInstallmentTotal) ? parsedInstallmentTotal : 1;
      if (formData.payment_method === "cartao" && (installmentTotal < 1 || installmentTotal > 60)) {
        throw new Error("Informe a quantidade de parcelas entre 1 e 60.");
      }

      const normalizedValue = Number(parsedValue.toFixed(2));

      const basePayload = {
        user_id: user.id,
        value: normalizedValue,
        date: normalizedDate.date,
        category: formData.category,
        payment_method: formData.payment_method || null,
        card_id: formData.payment_method === "cartao" ? formData.card_id || null : null,
        description: formData.description || null,
        is_installment: isEditing ? Boolean(editingRecord?.is_installment) : false,
        installment_group_id: isEditing ? editingRecord?.installment_group_id ?? null : null,
        installment_number: isEditing ? editingRecord?.installment_number ?? null : null,
        installment_total: isEditing ? editingRecord?.installment_total ?? null : null,
        original_purchase_date: isEditing ? editingRecord?.original_purchase_date ?? null : null,
        billed_month: toBillingMonth(normalizedDate.date),
      };

      if (isEditing) {
        await updateExpense(editingRecord.id, basePayload);
        toast.success("Despesa atualizada com sucesso!");
      } else {
        const shouldCreateInstallments = formData.payment_method === "cartao" && installmentTotal > 1;

        if (shouldCreateInstallments) {
          const installmentGroupId = createInstallmentGroupId();
          const installments = Array.from({ length: installmentTotal }, (_, index) => {
            const installmentDate = addMonthsToIsoDate(normalizedDate.date, index);
            return {
              ...basePayload,
              date: installmentDate,
              is_installment: true,
              installment_group_id: installmentGroupId,
              installment_number: index + 1,
              installment_total: installmentTotal,
              original_purchase_date: normalizedDate.date,
              billed_month: toBillingMonth(installmentDate),
            };
          });
          await createExpenses(installments);
          toast.success(`${installmentTotal} parcelas cadastradas com sucesso!`);
        } else {
          await createExpense(basePayload);
          toast.success("Despesa cadastrada com sucesso!");
        }
      }
      navigate("/despesas", { replace: true });
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Nao foi possivel cadastrar a despesa.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
          {isEditing ? "Editar despesa" : "Cadastrar despesa"}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {isEditing
            ? "Atualize os dados da despesa e salve as alteracoes."
            : "Preencha os campos abaixo para registrar uma nova despesa no Supabase."}
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
              step="0.01"
              min="0"
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
              required
              value={formData.category}
              onChange={handleChange}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            >
              <option value="">Selecione...</option>
              {EXPENSE_CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Forma de pagamento
            <select
              name="payment_method"
              value={formData.payment_method}
              onChange={handleChange}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            >
              <option value="">Selecione...</option>
              {PAYMENT_METHODS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {formData.payment_method === "cartao" && (
            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              Cartao
              <select
                name="card_id"
                required
                value={formData.card_id}
                onChange={handleChange}
                disabled={cardsLoading}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
              >
                <option value="">{cardsLoading ? "Carregando..." : "Selecione..."}</option>
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {formData.payment_method === "cartao" && (
            <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              Parcelas
              <input
                name="installment_total"
                type="number"
                min="1"
                max="60"
                value={formData.installment_total}
                onChange={handleChange}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
              />
            </label>
          )}
        </div>

        {formData.payment_method === "cartao" && !cardsLoading && (
          <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-600/50 dark:bg-amber-900/20 dark:text-amber-200">
            <p className="font-medium">
              {cards.length === 0 ? "Nenhum cartao cadastrado." : "Cadastrar novo cartao"}
            </p>
            <p className="mt-1 text-xs">
              {cards.length === 0
                ? "Crie um cartao rapido para registrar esta despesa no credito."
                : "Se o cartao nao estiver na lista, crie rapidamente por aqui."}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={quickCardForm.name}
                onChange={(event) => setQuickCardForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ex.: Nubank Roxo"
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-300/40 dark:border-amber-600/60 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-amber-400 dark:focus:ring-amber-500/30"
              />
              <input
                type="text"
                value={quickCardForm.brand}
                onChange={(event) => setQuickCardForm((prev) => ({ ...prev, brand: event.target.value }))}
                placeholder="Bandeira (opcional)"
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-300/40 dark:border-amber-600/60 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-amber-400 dark:focus:ring-amber-500/30 sm:max-w-[14rem]"
              />
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <input
                type="number"
                min="0"
                step="0.01"
                value={quickCardForm.credit_limit}
                onChange={(event) => setQuickCardForm((prev) => ({ ...prev, credit_limit: event.target.value }))}
                placeholder="Limite (R$)"
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-300/40 dark:border-amber-600/60 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-amber-400 dark:focus:ring-amber-500/30"
              />
              <input
                type="number"
                min="1"
                max="31"
                value={quickCardForm.due_day}
                onChange={(event) => setQuickCardForm((prev) => ({ ...prev, due_day: event.target.value }))}
                placeholder="Vencimento (1-31)"
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-300/40 dark:border-amber-600/60 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-amber-400 dark:focus:ring-amber-500/30"
              />
              <input
                type="number"
                min="1"
                max="31"
                value={quickCardForm.closing_day}
                onChange={(event) => setQuickCardForm((prev) => ({ ...prev, closing_day: event.target.value }))}
                placeholder="Fechamento (opcional)"
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-300/40 dark:border-amber-600/60 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-amber-400 dark:focus:ring-amber-500/30"
              />
            </div>
            <div className="mt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={handleCreateQuickCard}
                disabled={creatingCard}
                className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingCard ? "Criando..." : "Criar cartao"}
              </button>
            </div>
          </div>
        )}

        <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          Descricao
          <textarea
            name="description"
            rows={3}
            value={formData.description}
            onChange={handleChange}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            placeholder="Informe algum detalhe adicional (opcional)."
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
            {loading ? (isEditing ? "Atualizando..." : "Salvando...") : isEditing ? "Atualizar despesa" : "Salvar despesa"}
          </button>
        </div>
      </form>
    </div>
  );
}
