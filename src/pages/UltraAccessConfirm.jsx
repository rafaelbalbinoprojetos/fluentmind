import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import { confirmUltraAccess } from "../services/ultraAccess.js";

export default function UltraAccessConfirmPage() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  const token = useMemo(() => String(searchParams.get("token") || "").trim(), [searchParams]);
  const emailParam = useMemo(() => String(searchParams.get("email") || "").trim().toLowerCase(), [searchParams]);
  const userEmail = String(user?.email || "").trim().toLowerCase();
  const canConfirm = Boolean(token) && Boolean(session?.access_token) && Boolean(userEmail);
  const emailMatches = !emailParam || emailParam === userEmail;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    if (!emailMatches) {
      toast.error("Este link foi emitido para outro email.");
      return;
    }

    setLoading(true);
    try {
      await confirmUltraAccess({
        token,
        accessToken: session.access_token,
      });
      toast.success("Acesso vitalício confirmado com sucesso.");
      navigate("/configuracoes", { replace: true });
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Não foi possível confirmar o acesso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">Confirmar acesso vitalício</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Confirme seu acesso Ultra no aplicativo usando o link recebido.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
          <p>
            <span className="font-semibold text-gray-800 dark:text-gray-100">Email logado:</span>{" "}
            {userEmail || "não identificado"}
          </p>
          <p>
            <span className="font-semibold text-gray-800 dark:text-gray-100">Email do convite:</span>{" "}
            {emailParam || "não informado"}
          </p>
          {!token && <p className="text-rose-600 dark:text-rose-300">Token de confirmação ausente no link.</p>}
          {token && !emailMatches && (
            <p className="text-rose-600 dark:text-rose-300">O email logado não corresponde ao convite.</p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm || !emailMatches || loading}
            className="inline-flex items-center justify-center rounded-lg bg-temaSky px-4 py-2 text-sm font-semibold text-white transition hover:bg-temaSky-dark disabled:cursor-not-allowed disabled:opacity-60 dark:bg-temaEmerald dark:hover:bg-temaEmerald-dark"
          >
            {loading ? "Confirmando..." : "Confirmar acesso"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/configuracoes")}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-400 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600"
          >
            Voltar
          </button>
        </div>
      </section>
    </div>
  );
}
