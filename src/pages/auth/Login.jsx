import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext.jsx";
import ThemeSwitcher from "../../components/ThemeSwitcher.jsx";
import { translateAuthErrorMessage } from "../../utils/authErrors.js";

const LOGIN_BACKGROUNDS = [
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80",
];

const TERMS_ROUTE = "/termos-de-uso";
const PRIVACY_ROUTE = "/politica-de-privacidade";

export default function LoginPage() {
  const { signIn, session, error } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [authNotice, setAuthNotice] = useState(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailStatus, setEmailStatus] = useState("idle"); // idle | typing | checking | new | existing

  const heroImage = useMemo(() => {
    if (LOGIN_BACKGROUNDS.length === 0) return null;
    return LOGIN_BACKGROUNDS[Math.floor(Math.random() * LOGIN_BACKGROUNDS.length)];
  }, []);

  useEffect(() => {
    if (session) {
      const redirectTo = location.state?.from?.pathname ?? "/dashboard";
      navigate(redirectTo, { replace: true });
    }
  }, [navigate, location.state, session]);

  const emailHelperText = useMemo(() => {
    if (!formData.email) {
      return "Digite seu email para fazer login ou criar um cadastro em segundos.";
    }
    if (!formData.email.includes("@")) {
      return "Use um email válido, por exemplo: voce@exemplo.com";
    }
    if (emailStatus === "new") {
      return "Detectamos um novo email. Enviaremos um link de confirmação para o seu endereço.";
    }
    return "Se já existir uma conta, faremos o login. Caso contrário, criaremos uma para você.";
  }, [emailStatus, formData.email]);

  const emailHelperTone = emailStatus === "new" ? "text-emerald-600 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    if (name === "email") {
      setEmailStatus(value ? "typing" : "idle");
      setAuthNotice(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setFormError(null);
    setAuthNotice(null);
    setEmailStatus("checking");

    try {
      const result = await signIn({ email: formData.email, password: formData.password });

      if (result.status === "sign-up") {
        setEmailStatus("new");
        const normalizedEmail = formData.email.trim().toLowerCase();

        if (result.requiresEmailConfirmation) {
          toast.success(`Conta criada! Confirme pelo link enviado para ${normalizedEmail}.`);
          setAuthNotice(`Conta criada! Confirme o email ${normalizedEmail} para começar a usar o FluentMind.`);
        } else {
          toast.success("Conta criada com sucesso! Estamos preparando o seu ambiente.");
          setAuthNotice("Conta criada! Aproveite seu período de teste Premium por 7 dias.");
        }
      } else {
        setEmailStatus("existing");
        toast.success("Login realizado com sucesso.");
      }
    } catch (submitError) {
      const message = translateAuthErrorMessage(submitError, "Nao foi possivel entrar. Verifique os dados.");
      setFormError(message);
      setEmailStatus(submitError?.code === "existing_user_wrong_password" ? "existing" : "idle");
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setPasswordVisible((previous) => !previous);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-violet-950 to-sky-950 px-4 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
      </div>

      <div className="relative w-full max-w-5xl overflow-hidden rounded-[34px] border border-white/10 bg-white/15 shadow-2xl shadow-black/40 backdrop-blur-3xl dark:border-white/10">
        <div
          className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/10 to-white/5 dark:from-slate-900/70 dark:via-slate-900/40 dark:to-slate-900/60"
          aria-hidden="true"
        />

        <div className="relative grid grid-cols-1 overflow-hidden md:grid-cols-[1.25fr,1fr]">
          <div className="relative flex min-h-[260px] flex-col justify-between overflow-hidden bg-slate-900/80">
            {heroImage && (
              <img
                src={heroImage}
                alt="Estudante praticando idiomas com notebook"
                className="absolute inset-0 h-full w-full object-cover opacity-90"
                loading="lazy"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-violet-950/60 to-sky-700/45" aria-hidden="true" />

            <div className="relative z-10 flex flex-col gap-8 p-10 text-slate-100">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">
                  FluentMind
                </span>
                <h3 className="text-3xl font-semibold leading-snug text-white/95">
                  Stop translating. Start thinking.
                </h3>
                <p className="text-sm text-slate-200/80">
                  Pratique conversas com IA, salve expressoes uteis, revise erros corrigidos e acompanhe sua evolucao em um so lugar.
                </p>
              </div>

              <div className="space-y-4 text-sm text-slate-200/70">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sky-200">
                    <span className="text-sm font-semibold" aria-hidden="true">
                      AI
                    </span>
                  </div>
                  <p>
                    Acesso imediato ao plano gratuito e 7 dias com conversas de IA, voz, revisao inteligente e playlists.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-violet-200">
                    <span className="text-sm font-semibold" aria-hidden="true">
                      ID
                    </span>
                  </div>
                  <p>Se já tiver cadastro, basta informar sua senha. Se for novo por aqui, criamos sua conta automaticamente.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative bg-white/95 px-8 py-10 sm:px-10 md:pl-12 md:pr-10 dark:bg-slate-950/90">
            <div className="absolute -top-16 right-10 h-32 w-32 rounded-full bg-emerald-200/10 blur-3xl" aria-hidden="true" />
            <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-sky-200/10 blur-3xl" aria-hidden="true" />

            <div className="relative flex items-start justify-between">
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Bem-vindo</h1>
                <p className="text-sm text-slate-500 dark:text-slate-300">Use o mesmo formulário para entrar ou criar sua conta em segundos.</p>
              </div>
              <div className="-mr-2">
                <ThemeSwitcher />
              </div>
            </div>

            <form className="relative mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  enterKeyHint="next"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-900 shadow-[0_15px_40px_-20px_rgba(15,23,42,0.35)] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-violet-300"
                  placeholder="voce@exemplo.com"
                />
                <p className={`text-xs leading-relaxed ${emailHelperTone}`}>{emailHelperText}</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={passwordVisible ? "text" : "password"}
                    autoComplete="current-password"
                    enterKeyHint="done"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-3 pr-12 text-sm text-slate-900 shadow-[0_15px_40px_-20px_rgba(15,23,42,0.35)] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-violet-300"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-semibold uppercase tracking-[0.16em] text-violet-500 transition hover:text-violet-600 dark:text-violet-300 dark:hover:text-violet-200"
                    aria-pressed={passwordVisible}
                  >
                    {passwordVisible ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                <div>
                  <Link
                    to="/recuperar-senha"
                    className="text-xs font-semibold text-violet-600 transition hover:text-violet-500 dark:text-violet-300 dark:hover:text-violet-200"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
              </div>

              {(formError || error) && (
                <div
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 shadow-inner dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-200"
                  role="alert"
                >
                  {formError || error?.message || "Não foi possível entrar. Verifique os dados."}
                </div>
              )}

              {authNotice && (
                <div
                  className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 shadow-inner dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200"
                  role="status"
                >
                  {authNotice}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:from-violet-400 hover:to-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Conectando..." : "Entrar ou Criar conta"}
              </button>

              <p className="text-center text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                Ao criar, você concorda com nossos{" "}
                <Link to={TERMS_ROUTE} className="font-semibold text-violet-600 hover:text-violet-500 dark:text-violet-300">
                  termos de uso
                </Link>{" "}
                e{" "}
                <Link to={PRIVACY_ROUTE} className="font-semibold text-violet-600 hover:text-violet-500 dark:text-violet-300">
                  política de privacidade
                </Link>
                .
              </p>
            </form>

            <p className="relative mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
              Em breve: login com Google ou Apple para agilizar ainda mais seu acesso.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
