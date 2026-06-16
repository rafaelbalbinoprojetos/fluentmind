import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import ThemeSwitcher from "../../components/ThemeSwitcher.jsx";
import { supabase, supabaseConfigured } from "../../lib/supabase.js";
import { translateAuthErrorMessage } from "../../utils/authErrors.js";

const LOGIN_ROUTE = "/app";

function hasRecoveryParams() {
  if (typeof window === "undefined") return false;
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const type = searchParams.get("type") ?? hashParams.get("type");
  const hasToken = Boolean(hashParams.get("access_token") || searchParams.get("access_token"));
  return type === "recovery" || hasToken;
}

export default function PasswordRecoveryPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("checking"); // checking | request | update
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    let ignore = false;

    const resolveMode = async () => {
      if (!supabaseConfigured || !supabase) {
        setMode("request");
        setErrorMessage("Supabase não configurado. Verifique as variáveis de ambiente do projeto.");
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (ignore) return;

        const recoveryFlow = hasRecoveryParams();
        if (recoveryFlow || data.session) {
          setMode("update");
          return;
        }
        setMode("request");
      } catch (error) {
        if (ignore) return;
        setMode("request");
        setErrorMessage(
          translateAuthErrorMessage(error, "Nao foi possivel validar o link de recuperacao. Solicite um novo email."),
        );
      }
    };

    resolveMode();

    if (!supabaseConfigured || !supabase) {
      return () => {
        ignore = true;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (ignore) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setMode("update");
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleRequestReset = async (event) => {
    event.preventDefault();
    if (!email.trim()) {
      setErrorMessage("Informe seu email para recuperar a senha.");
      return;
    }

    setRequesting(true);
    setErrorMessage(null);
    setNotice(null);
    try {
      if (!supabaseConfigured || !supabase) {
        throw new Error("Supabase não configurado.");
      }
      const redirectTo = import.meta.env.VITE_SUPABASE_RESET_REDIRECT ?? `${window.location.origin}/recuperar-senha`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      const normalizedEmail = email.trim().toLowerCase();
      setNotice(`Enviamos um link de recuperacao para ${normalizedEmail}. Verifique caixa de entrada e spam.`);
      toast.success("Link de recuperacao enviado.");
    } catch (error) {
      setErrorMessage(translateAuthErrorMessage(error, "Nao foi possivel enviar o link de recuperacao."));
    } finally {
      setRequesting(false);
    }
  };

  const handleUpdatePassword = async (event) => {
    event.preventDefault();
    if (password.length < 6) {
      setErrorMessage("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== passwordConfirm) {
      setErrorMessage("A confirmacao da senha nao confere.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setNotice(null);
    try {
      if (!supabaseConfigured || !supabase) {
        throw new Error("Supabase não configurado.");
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("Senha atualizada com sucesso.");
      setNotice("Senha alterada. Voce ja pode entrar com a nova senha.");
      await supabase.auth.signOut();
      navigate(LOGIN_ROUTE, { replace: true });
    } catch (error) {
      setErrorMessage(translateAuthErrorMessage(error, "Nao foi possivel atualizar sua senha."));
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = useMemo(() => {
    if (mode === "update") return "Definir nova senha";
    return "Recuperar senha";
  }, [mode]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/95 p-8 shadow-2xl dark:bg-slate-950/90">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{pageTitle}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
              {mode === "update"
                ? "Informe sua nova senha para concluir a recuperacao."
                : "Informe seu email para receber o link de recuperacao."}
            </p>
          </div>
          <ThemeSwitcher />
        </div>

        {mode === "checking" ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
            Validando link de recuperacao...
          </p>
        ) : mode === "update" ? (
          <form className="space-y-4" onSubmit={handleUpdatePassword}>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400" htmlFor="password">
                Nova senha
              </label>
              <input
                id="password"
                type="password"
                minLength={6}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Minimo de 6 caracteres"
              />
            </div>
            <div className="space-y-1">
              <label
                className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"
                htmlFor="passwordConfirm"
              >
                Confirmar nova senha
              </label>
              <input
                id="passwordConfirm"
                type="password"
                minLength={6}
                required
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Repita a nova senha"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:from-emerald-500 hover:to-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Salvando nova senha..." : "Salvar nova senha"}
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleRequestReset}>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="voce@exemplo.com"
              />
            </div>
            <button
              type="submit"
              disabled={requesting}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:from-emerald-500 hover:to-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {requesting ? "Enviando link..." : "Enviar link de recuperacao"}
            </button>
          </form>
        )}

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-200">
            {errorMessage}
          </div>
        )}
        {notice && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200">
            {notice}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Lembrou da senha?{" "}
          <Link className="font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-300" to={LOGIN_ROUTE}>
            Voltar para login
          </Link>
        </p>
      </div>
    </div>
  );
}
