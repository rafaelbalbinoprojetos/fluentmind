import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import { getAssetBySymbol, upsertAsset } from "../services/assets.js";
import { upsertPortfolioPosition } from "../services/portfolio.js";
import { ASSET_TYPES } from "../utils/constants.js";
import { normalizeDateForSupabase, parseDecimalInput } from "../utils/forms.js";
import { toDateInputValue } from "../utils/formatters.js";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

const ORIGIN_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "automatico", label: "Automatico" },
  { value: "importado", label: "Importado" },
];

const INITIAL_STATE = {
  symbol: "",
  assetName: "",
  assetType: "",
  currency: "BRL",
  quantity: "",
  averagePrice: "",
  purchaseDate: "",
  origin: "manual",
  notes: "",
};

function normalizeAssetSymbol(value) {
  const trimmed = (value ?? "").trim().toUpperCase();
  if (!trimmed) return "";
  if (!trimmed.includes(".") && /^[A-Z]{4}\d{1,2}$/.test(trimmed)) {
    return `${trimmed}.SA`;
  }
  return trimmed;
}

export default function InvestmentCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const editingPosition = location.state?.position ?? null;
  const isEditing = Boolean(editingPosition?.id);

  const [formData, setFormData] = useState(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [fetchingAsset, setFetchingAsset] = useState(false);

  useEffect(() => {
    if (!editingPosition) {
      setFormData(INITIAL_STATE);
      return;
    }

    async function hydrate() {
      setLoading(true);
      try {
        const originalSymbol = editingPosition.ativo_symbol ?? "";
        const normalizedSymbol = normalizeAssetSymbol(originalSymbol);

        let asset = null;
        if (originalSymbol) {
          asset = await getAssetBySymbol(originalSymbol);
        }
        if (!asset && normalizedSymbol && normalizedSymbol !== originalSymbol) {
          asset = await getAssetBySymbol(normalizedSymbol);
        }

        setFormData({
          symbol: normalizedSymbol || originalSymbol,
          assetName: asset?.nome ?? "",
          assetType: editingPosition.tipo ?? asset?.tipo ?? "",
          currency: asset?.moeda ?? "BRL",
          quantity: editingPosition.quantidade !== null ? String(editingPosition.quantidade) : "",
          averagePrice: editingPosition.preco_medio !== null ? String(editingPosition.preco_medio) : "",
          purchaseDate: toDateInputValue(editingPosition.data_compra) ?? "",
          origin: editingPosition.origem ?? "manual",
          notes: editingPosition.observacoes ?? "",
        });
      } catch (error) {
        console.error(error);
        toast.error("Nao foi possivel carregar os detalhes do ativo.");
      } finally {
        setLoading(false);
      }
    }

    hydrate();
  }, [editingPosition]);

  const selectedAssetType = useMemo(
    () => ASSET_TYPES.find((type) => type.value === formData.assetType) ?? null,
    [formData.assetType],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSymbolBlur = async () => {
    const normalized = normalizeAssetSymbol(formData.symbol);
    if (!normalized) return;

    setFormData((prev) => ({ ...prev, symbol: normalized }));

    setFetchingAsset(true);
    try {
      let asset = await getAssetBySymbol(normalized);
      if (!asset && normalized.endsWith(".SA")) {
        const base = normalized.replace(".SA", "");
        asset = await getAssetBySymbol(base);
      }
      if (asset) {
        setFormData((prev) => ({
          ...prev,
          assetName: asset.nome ?? prev.assetName,
          assetType: asset.tipo ?? prev.assetType,
          currency: asset.moeda ?? prev.currency,
        }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setFetchingAsset(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) {
      toast.error("Faca login para registrar ativos.");
      return;
    }

    const normalizedSymbol = normalizeAssetSymbol(formData.symbol);
    setFormData((prev) => ({ ...prev, symbol: normalizedSymbol }));

    if (!normalizedSymbol) {
      toast.error("Informe o simbolo do ativo (ex.: PETR4.SA, AAPL, BTC-USD).");
      return;
    }

    const quantity = parseDecimalInput(formData.quantity);
    const averagePrice = parseDecimalInput(formData.averagePrice);

    if (quantity === null || quantity <= 0) {
      toast.error("Informe a quantidade comprada.");
      return;
    }

    if (averagePrice === null || averagePrice < 0) {
      toast.error("Informe o preco medio de compra.");
      return;
    }

    const normalizedDate = normalizeDateForSupabase(formData.purchaseDate);
    if (!normalizedDate) {
      toast.error("Informe uma data de compra valida.");
      return;
    }

    if (!formData.assetType) {
      toast.error("Selecione o tipo de ativo.");
      return;
    }

    setLoading(true);
    try {
      await upsertAsset({
        symbol: normalizedSymbol,
        nome: formData.assetName?.trim() || normalizedSymbol,
        tipo: formData.assetType,
        moeda: formData.currency || "BRL",
      });

      await upsertPortfolioPosition({
        id: editingPosition?.id,
        userId: user.id,
        ativoSymbol: normalizedSymbol,
        quantidade: Number(quantity),
        preco_medio: Number(averagePrice),
        data_compra: normalizedDate.date,
        tipo: formData.assetType,
        origem: formData.origin,
        observacoes: formData.notes?.trim() || null,
      });

      const quotesEndpoint = API_BASE ? `${API_BASE}/api/investments/update-quotes` : "/api/investments/update-quotes";
      try {
        const response = await fetch(quotesEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols: [normalizedSymbol] }),
        });
        if (!response.ok) {
          console.warn("Nao foi possivel atualizar a cotacao imediatamente:", await response.text());
        }
      } catch (updateError) {
        console.warn("Nao foi possivel atualizar a cotacao imediatamente:", updateError);
      }

      toast.success(isEditing ? "Posicao atualizada com sucesso!" : "Ativo adicionado a carteira.");
      navigate("/investir", { replace: true });
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Nao foi possivel salvar o ativo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
          {isEditing ? "Atualizar posicao" : "Adicionar ativo a carteira"}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Informe o simbolo, quantidade e preco medio para consolidar a rentabilidade. O KORDEN consulta a Yahoo Finance automaticamente.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Simbolo do ativo
            <input
              name="symbol"
              value={formData.symbol}
              onChange={handleChange}
              onBlur={handleSymbolBlur}
              placeholder="Ex.: PETR4.SA, AAPL, BTC-USD"
              required
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            />
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
              Use o simbolo no formato Yahoo Finance. Ex.: VALE3.SA para B3, BTC-USD para Bitcoin em dolar.
            </span>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Nome do ativo
            <input
              name="assetName"
              value={formData.assetName}
              onChange={handleChange}
              placeholder="Nome exibido (opcional)"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Tipo
            <select
              name="assetType"
              value={formData.assetType}
              onChange={handleChange}
              required
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            >
              <option value="">Selecione...</option>
              {ASSET_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Moeda da cotacao
            <input
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              maxLength={3}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm uppercase text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            />
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">Ex.: BRL, USD, EUR.</span>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Quantidade
            <input
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              type="number"
              min="0"
              step="0.0001"
              required
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Preco medio ({formData.currency})
            <input
              name="averagePrice"
              value={formData.averagePrice}
              onChange={handleChange}
              type="number"
              min="0"
              step="0.0001"
              required
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Data do aporte
            <input
              name="purchaseDate"
              value={formData.purchaseDate}
              onChange={handleChange}
              type="date"
              required
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Origem
            <select
              name="origin"
              value={formData.origin}
              onChange={handleChange}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
            >
              {ORIGIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          Observacoes (opcional)
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            placeholder="Detalhes adicionais sobre o investimento."
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-temaSky focus:outline-none focus:ring-2 focus:ring-temaSky/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-temaEmerald dark:focus:ring-temaEmerald/20"
          />
        </label>

        {selectedAssetType ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-4 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <p>
              <strong>Tipo selecionado:</strong> {selectedAssetType.label}. O KORDEN vai sincronizar a cotacao automaticamente.
            </p>
            {fetchingAsset && <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">Sincronizando dados do ativo...</p>}
          </div>
        ) : null}

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
            {loading ? (isEditing ? "Atualizando..." : "Salvando...") : isEditing ? "Atualizar ativo" : "Cadastrar ativo"}
          </button>
        </div>
      </form>
    </div>
  );
}

