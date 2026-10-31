import { useEffect, useId, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowRight, BookMarked, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, MessageCircle, Mic, RefreshCw, Wand2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import ThemeSwitcher from "../../components/ThemeSwitcher.jsx";
import { Logo } from "../../components/landing/LandingParts.jsx";
import { translateAuthErrorMessage } from "../../utils/authErrors.js";
import "../../components/landing/landing.css";
import "./login.css";

const TERMS_ROUTE = "/termos-de-uso";
const PRIVACY_ROUTE = "/politica-de-privacidade";
const MIN_PASSWORD = 6; // mesmo mínimo exigido pelo Supabase e pela tela anterior
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHOTO = "https://images.unsplash.com/photo-1616587226960-4a03badbe8bf?auto=format&fit=crop&q=70";

const FEATURES = [
  [MessageCircle, "Conversas com o mentor de IA"],
  [Wand2, "Correções que explicam o erro"],
  [RefreshCw, "Revisão inteligente no tempo certo"],
  [Mic, "Prática de fala com shadowing"],
];

// A autenticação do FluentMind é unificada (AuthContext.signIn): tenta entrar e, se o email ainda não
// tiver conta, cria uma. As abas só ajustam a comunicação; o fluxo e as validações são os mesmos.
const MODES = {
  login: {
    tab: "Entrar",
    title: "Bem-vindo de volta!",
    text: "Entre na sua conta ou comece sua jornada com o FluentMind.",
    submit: "Entrar na minha conta",
    loading: "Entrando…",
    autocomplete: "current-password",
    hint: "Se o email ainda não tiver conta, ela é criada com esta senha.",
  },
  signup: {
    tab: "Criar conta",
    title: "Crie sua conta",
    text: "Leva segundos. Depois é só confirmar seu email e começar a praticar.",
    submit: "Criar minha conta",
    loading: "Criando sua conta…",
    autocomplete: "new-password",
    hint: "Se este email já tiver conta, faremos o login com a senha informada.",
  },
};

export default function LoginPage() {
  const { signIn, session, error } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const ids = useId();

  const [mode, setMode] = useState("login");
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [touched, setTouched] = useState({ email: false, password: false });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [authNotice, setAuthNotice] = useState(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const copy = MODES[mode];

  useEffect(() => {
    if (session) {
      const redirectTo = location.state?.from?.pathname ?? "/dashboard";
      navigate(redirectTo, { replace: true });
    }
  }, [navigate, location.state, session]);

  const email = formData.email.trim();
  const emailError = !email ? "Informe seu email." : !EMAIL_PATTERN.test(email) ? "Use um email válido, por exemplo: voce@exemplo.com" : null;
  const passwordError = !formData.password
    ? "Informe sua senha."
    : formData.password.length < MIN_PASSWORD
      ? `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`
      : null;
  const showEmailError = touched.email && emailError;
  const showPasswordError = touched.password && passwordError;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setFormError(null);
    if (name === "email") setAuthNotice(null);
  };

  const switchMode = (next) => {
    if (loading || next === mode) return;
    setMode(next);
    setFormError(null);
    setAuthNotice(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setTouched({ email: true, password: true });
    if (emailError || passwordError) return;

    setLoading(true);
    setFormError(null);
    setAuthNotice(null);

    try {
      const result = await signIn({ email: formData.email, password: formData.password });
      if (result.status === "sign-up") {
        const normalizedEmail = email.toLowerCase();
        if (result.requiresEmailConfirmation) {
          toast.success(`Conta criada! Confirme pelo link enviado para ${normalizedEmail}.`);
          setAuthNotice(`Conta criada! Confirme o email ${normalizedEmail} para começar a usar o FluentMind.`);
        } else {
          toast.success("Conta criada com sucesso! Estamos preparando o seu ambiente.");
          setAuthNotice("Conta criada! Aproveite seu período de teste Premium por 7 dias.");
        }
      } else {
        toast.success("Login realizado com sucesso.");
      }
    } catch (submitError) {
      setFormError(translateAuthErrorMessage(submitError, "Não foi possível entrar. Verifique os dados."));
    } finally {
      setLoading(false);
    }
  };

  const errorText = formError || error?.message;

  return (
    <div className="fl-landing fa-auth">
      <div className="fa-shell">
        <aside className="fa-intro" aria-label="Sobre o FluentMind">
          <Link to="/" className="fa-logo-link" aria-label="FluentMind, página inicial">
            <Logo />
          </Link>
          <div className="fa-intro-copy">
            <span className="fl-badge">✦ Aprenda com inteligência</span>
            <h2 className="fa-headline">
              Stop translating.
              <span className="fl-gradient-text">Start thinking.</span>
            </h2>
            <p className="fa-sub">
              Converse com IA, transforme expressões úteis em MindBlocks, revise no momento certo e treine a fala até o inglês sair natural.
            </p>
            <ul className="fa-features">
              {FEATURES.map(([icon, label]) => (
                <FeatureItem key={label} icon={icon} label={label} />
              ))}
            </ul>
          </div>
          <div className="fa-visual">
            <div className="fa-photo">
              <img
                src={`${PHOTO}&w=900`}
                srcSet={`${PHOTO}&w=600 600w, ${PHOTO}&w=900 900w, ${PHOTO}&w=1300 1300w`}
                sizes="(max-width: 1100px) 50vw, 640px"
                width="900"
                height="600"
                alt="Pessoa conversando por vídeo no notebook enquanto pratica um idioma"
                decoding="async"
              />
            </div>
            <article className="fa-card fa-card-fix" aria-label="Exemplo de correção">
              <span className="fl-example-tag">Exemplo</span>
              <p><s>She don&apos;t like coffee.</s></p>
              <p><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> She <b>doesn&apos;t</b> like coffee.</p>
            </article>
            <article className="fa-card fa-card-block" aria-label="Exemplo de MindBlock">
              <BookMarked className="h-4 w-4" aria-hidden="true" />
              <span><b>I&apos;m looking forward to it.</b><small>Estou ansioso por isso.</small></span>
            </article>
          </div>
        </aside>

        <main className="fa-panel">
          <div className="fa-panel-top">
            <Link to="/" className="fa-logo-mobile" aria-label="FluentMind, página inicial">
              <Logo compact />
            </Link>
            <ThemeSwitcher />
          </div>

          <p className="fa-mobile-headline">
            Stop translating. <span className="fl-gradient-text">Start thinking.</span>
          </p>

          <div key={mode} className="fa-head">
            <h1>{copy.title}</h1>
            <p>{copy.text}</p>
          </div>

          <div className="fa-tabs" role="tablist" aria-label="Escolha entre entrar ou criar conta">
            {Object.entries(MODES).map(([key, value]) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`${ids}-tab-${key}`}
                aria-selected={mode === key}
                aria-controls={`${ids}-form`}
                className={mode === key ? "is-active" : ""}
                onClick={() => switchMode(key)}
              >
                {value.tab}
              </button>
            ))}
            <span className={`fa-tabs-indicator ${mode === "signup" ? "is-right" : ""}`} aria-hidden="true" />
          </div>

          <form id={`${ids}-form`} role="tabpanel" aria-labelledby={`${ids}-tab-${mode}`} className="fa-form" onSubmit={handleSubmit} noValidate>
            <div className="fa-field">
              <label htmlFor={`${ids}-email`}>Email</label>
              <div className={`fa-input ${showEmailError ? "has-error" : ""}`}>
                <Mail className="h-4 w-4" aria-hidden="true" />
                <input
                  id={`${ids}-email`}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={() => setTouched((current) => ({ ...current, email: true }))}
                  aria-invalid={Boolean(showEmailError)}
                  aria-describedby={showEmailError ? `${ids}-email-error` : undefined}
                  placeholder="voce@exemplo.com"
                />
              </div>
              {showEmailError ? <p id={`${ids}-email-error`} className="fa-field-error">{emailError}</p> : null}
            </div>

            <div className="fa-field">
              <div className="fa-label-row">
                <label htmlFor={`${ids}-password`}>Senha</label>
                {mode === "login" ? <Link to="/recuperar-senha" className="fa-link">Esqueci minha senha</Link> : null}
              </div>
              <div className={`fa-input ${showPasswordError ? "has-error" : ""}`}>
                <Lock className="h-4 w-4" aria-hidden="true" />
                <input
                  id={`${ids}-password`}
                  name="password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete={copy.autocomplete}
                  enterKeyHint="done"
                  required
                  minLength={MIN_PASSWORD}
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={() => setTouched((current) => ({ ...current, password: true }))}
                  aria-invalid={Boolean(showPasswordError)}
                  aria-describedby={`${ids}-password-help`}
                  placeholder={mode === "signup" ? `Mínimo de ${MIN_PASSWORD} caracteres` : "Sua senha"}
                />
                <button
                  type="button"
                  className="fa-eye"
                  onClick={() => setPasswordVisible((value) => !value)}
                  aria-pressed={passwordVisible}
                  aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
                >
                  {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p id={`${ids}-password-help`} className={showPasswordError ? "fa-field-error" : "fa-field-help"}>
                {showPasswordError ? passwordError : mode === "signup" ? `Use pelo menos ${MIN_PASSWORD} caracteres.` : copy.hint}
              </p>
            </div>

            {errorText ? (
              <div className="fa-alert fa-alert-error" role="alert">
                {errorText}
                {mode === "login" ? <> <Link to="/recuperar-senha" className="fa-link">Recuperar acesso</Link></> : null}
              </div>
            ) : null}
            {authNotice ? <div className="fa-alert fa-alert-success" role="status">{authNotice}</div> : null}

            <button type="submit" className="fl-btn fl-btn-primary fl-btn-lg fa-submit" disabled={loading} aria-busy={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {copy.loading}</>
              ) : (
                <>{copy.submit} <ArrowRight className="h-4 w-4" aria-hidden="true" /></>
              )}
            </button>

            {mode === "signup" ? <p className="fa-field-help fa-center">{copy.hint}</p> : null}

            <p className="fa-legal">
              {mode === "signup" ? "Ao criar sua conta, você concorda com os " : "Ao entrar, você continua de acordo com os "}
              <Link to={TERMS_ROUTE} className="fa-link">Termos de uso</Link> e a{" "}
              <Link to={PRIVACY_ROUTE} className="fa-link">Política de privacidade</Link>.
            </p>
          </form>

          <p className="fa-switch">
            {mode === "login" ? "Novo por aqui? " : "Já tem conta? "}
            <button type="button" className="fa-link" onClick={() => switchMode(mode === "login" ? "signup" : "login")}>
              {mode === "login" ? "Criar conta" : "Entrar"}
            </button>
          </p>
        </main>
      </div>
    </div>
  );
}

function FeatureItem({ icon, label }) {
  const Icon = icon;
  return (
    <li>
      <span className="fl-icon-chip" aria-hidden="true"><Icon className="h-4 w-4" /></span>
      {label}
    </li>
  );
}
