import { createElement, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookMarked,
  Briefcase,
  CheckCircle2,
  Clock,
  Headphones,
  Languages,
  LineChart,
  Menu,
  MessageCircle,
  Mic,
  MonitorSmartphone,
  Plane,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Wand2,
  X,
} from "lucide-react";

const APP_ROUTE = "/app"; // login e cadastro (quem já está logado vai direto ao dashboard)

const NAV = [
  { id: "inicio", label: "Início" },
  { id: "recursos", label: "Recursos" },
  { id: "como-funciona", label: "Como funciona" },
  { id: "para-quem", label: "Para quem é" },
];

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/** Revela o elemento quando entra na tela (IntersectionObserver nativo, sem dependências). */
export function Reveal({ as = "div", className = "", delay = 0, children, ...rest }) {
  const Tag = as;
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`fl-reveal ${visible ? "is-visible" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}

export function Logo({ compact = false }) {
  return (
    <span className="fl-logo">
      <span className="fl-logo-mark" aria-hidden="true">FM</span>
      <span>
        <span className="fl-logo-name">FluentMind</span>
        {!compact ? <span className="fl-logo-tagline">Think in English. Live Further.</span> : null}
      </span>
    </span>
  );
}

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (id) => {
    setOpen(false);
    scrollToSection(id);
  };

  return (
    <header className={`fl-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="fl-container fl-header-inner">
        <a href="#inicio" onClick={(event) => { event.preventDefault(); go("inicio"); }} aria-label="FluentMind, voltar ao início">
          <Logo />
        </a>
        <nav className="fl-nav" aria-label="Seções da página">
          {NAV.map((item) => (
            <a key={item.id} href={`#${item.id}`} onClick={(event) => { event.preventDefault(); go(item.id); }}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="fl-header-actions">
          <Link to={APP_ROUTE} className="fl-btn fl-btn-ghost fl-hide-sm">Entrar</Link>
          <Link to={APP_ROUTE} className="fl-btn fl-btn-primary fl-hide-sm">
            Começar agora <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="fl-menu-toggle"
            aria-expanded={open}
            aria-controls="fl-mobile-menu"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open ? (
        <div id="fl-mobile-menu" className="fl-mobile-menu">
          {NAV.map((item) => (
            <a key={item.id} href={`#${item.id}`} onClick={(event) => { event.preventDefault(); go(item.id); }}>
              {item.label}
            </a>
          ))}
          <div className="fl-mobile-menu-actions">
            <Link to={APP_ROUTE} className="fl-btn fl-btn-ghost">Entrar</Link>
            <Link to={APP_ROUTE} className="fl-btn fl-btn-primary">
              Começar agora <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

const HERO_BENEFITS = [
  { icon: MessageCircle, title: "Conversas com IA", text: "Pratique situações reais com o mentor Neo." },
  { icon: Wand2, title: "Correções inteligentes", text: "Entenda o erro e a forma natural." },
  { icon: Sparkles, title: "Evolução personalizada", text: "Revisões no momento certo para você." },
  { icon: LineChart, title: "Acompanhe o progresso", text: "Veja suas expressões e sua evolução." },
];

// Foto Unsplash (licença livre). Para trocar, basta mudar o id.
const HERO_PHOTO = "https://images.unsplash.com/photo-1616587226960-4a03badbe8bf?auto=format&fit=crop&q=75";

export function HeroSection() {
  return (
    <section id="inicio" className="fl-hero" aria-labelledby="fl-hero-title">
      <div className="fl-hero-glow" aria-hidden="true" />
      <div className="fl-container fl-hero-grid">
        <div className="fl-hero-copy">
          <span className="fl-badge fl-enter" style={{ "--d": "0ms" }}>✦ Aprenda inglês com inteligência</span>
          <h1 id="fl-hero-title" className="fl-hero-title fl-enter" style={{ "--d": "80ms" }}>
            Pense em inglês.
            <span className="fl-gradient-text">Vá mais longe.</span>
          </h1>
          <p className="fl-hero-sub fl-enter" style={{ "--d": "180ms" }}>
            O FluentMind usa inteligência artificial para criar conversas reais, feedback personalizado e uma experiência de
            aprendizado que evolui com você.
          </p>
          <ul className="fl-hero-benefits fl-enter" style={{ "--d": "260ms" }}>
            {HERO_BENEFITS.map(({ icon, title, text }) => (
              <li key={title}>
                <span className="fl-icon-chip" aria-hidden="true">{createElement(icon, { className: "h-4 w-4" })}</span>
                <span>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </span>
              </li>
            ))}
          </ul>
          <div className="fl-hero-ctas fl-enter" style={{ "--d": "340ms" }}>
            <Link to={APP_ROUTE} className="fl-btn fl-btn-primary fl-btn-lg">
              Começar agora <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a href="#recursos" className="fl-btn fl-btn-ghost fl-btn-lg" onClick={(event) => { event.preventDefault(); scrollToSection("recursos"); }}>
              <Play className="h-4 w-4" aria-hidden="true" /> Ver como funciona
            </a>
          </div>
        </div>

        <div className="fl-hero-visual">
          <div className="fl-hero-photo fl-enter-fade">
            <img
              src={`${HERO_PHOTO}&w=1100`}
              srcSet={`${HERO_PHOTO}&w=640 640w, ${HERO_PHOTO}&w=1100 1100w, ${HERO_PHOTO}&w=1600 1600w`}
              sizes="(max-width: 1024px) 92vw, 46vw"
              width="1100"
              height="733"
              alt="Pessoa conversando por vídeo no notebook enquanto pratica um idioma"
              fetchpriority="high"
              decoding="async"
            />
          </div>

          <article className="fl-float-card fl-card-chat fl-enter" style={{ "--d": "420ms" }} aria-label="Exemplo de conversa com a IA">
            <header>
              <span className="fl-icon-chip" aria-hidden="true"><Sparkles className="h-4 w-4" /></span>
              <strong>FluentMind AI</strong>
              <span className="fl-example-tag">Exemplo</span>
            </header>
            <p className="fl-bubble fl-bubble-user">I go to the beach yesterday.</p>
            <p className="fl-bubble fl-bubble-ai">
              Great job! Your English is improving. Just one fix: <b>I went</b> to the beach yesterday.
            </p>
          </article>

          <article className="fl-float-card fl-card-progress fl-enter" style={{ "--d": "520ms" }} aria-label="Exemplo de progresso">
            <header>
              <strong>Seu progresso</strong>
              <span className="fl-example-tag">Exemplo</span>
            </header>
            <div className="fl-progress-ring" role="img" aria-label="Exemplo: 68% de domínio das expressões">
              <svg viewBox="0 0 36 36" aria-hidden="true">
                <circle cx="18" cy="18" r="15.5" className="track" />
                <circle cx="18" cy="18" r="15.5" className="value" strokeDasharray="68 100" pathLength="100" />
              </svg>
              <span>68%</span>
            </div>
            <small>domínio das expressões</small>
          </article>

          <article className="fl-float-card fl-card-goal fl-enter" style={{ "--d": "620ms" }} aria-label="Exemplo de meta">
            <span className="fl-icon-chip" aria-hidden="true"><Target className="h-4 w-4" /></span>
            <span>
              <strong>Sua meta</strong>
              <small>Conversar com confiança em viagens.</small>
            </span>
            <CheckCircle2 className="fl-goal-check h-5 w-5" aria-hidden="true" />
          </article>

          <span className="fl-float-pill fl-enter" style={{ "--d": "720ms" }}>
            <Languages className="h-4 w-4" aria-hidden="true" /> Natural conversation
          </span>
        </div>
      </div>
    </section>
  );
}

const STRIP = [
  { icon: Clock, title: "Aprenda no seu ritmo", text: "Quando e onde quiser." },
  { icon: MonitorSmartphone, title: "Em todos os dispositivos", text: "Web, celular e tablet." },
  { icon: Target, title: "Experiência personalizada", text: "Focada nos seus objetivos." },
  { icon: ShieldCheck, title: "Seus dados protegidos", text: "Privacidade e segurança." },
];

export function BenefitsStrip() {
  return (
    <Reveal as="section" className="fl-container fl-strip" aria-label="Diferenciais">
      {STRIP.map(({ icon, title, text }) => (
        <div key={title} className="fl-strip-item">
          {createElement(icon, { className: "h-5 w-5", "aria-hidden": true })}
          <span>
            <strong>{title}</strong>
            <small>{text}</small>
          </span>
        </div>
      ))}
    </Reveal>
  );
}

function SectionHead({ eyebrow, title, text, id }) {
  return (
    <Reveal className="fl-section-head">
      {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
      <h2 id={id} className="fl-section-title">{title}</h2>
      {text ? <p className="fl-section-text">{text}</p> : null}
    </Reveal>
  );
}

const STEPS = [
  {
    n: "01",
    icon: MessageCircle,
    title: "Comece uma conversa",
    text: "Escolha um assunto e pratique inglês com inteligência artificial.",
    sample: <p className="fl-mini-bubble">“How was your weekend?”</p>,
  },
  {
    n: "02",
    icon: Wand2,
    title: "Aprenda com seus erros",
    text: "Receba explicações e sugestões para melhorar sua comunicação.",
    sample: (
      <p className="fl-mini-fix">
        <s>She don't like</s> → <b>She doesn't like</b>
      </p>
    ),
  },
  {
    n: "03",
    icon: RefreshCw,
    title: "Acompanhe sua evolução",
    text: "Revise expressões, identifique dificuldades e desenvolva confiança.",
    sample: <p className="fl-mini-bubble">Próxima revisão: em 6 dias</p>,
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="fl-section" aria-labelledby="fl-how-title">
      <div className="fl-container">
        <SectionHead
          id="fl-how-title"
          eyebrow="Como funciona"
          title="Aprender inglês pode ser mais natural."
          text="Pratique, receba feedback e evolua no seu ritmo."
        />
        <ol className="fl-steps">
          {STEPS.map(({ n, icon, title, text, sample }, index) => (
            <Reveal as="li" key={n} delay={index * 90} className="fl-step">
              <span className="fl-step-n" aria-hidden="true">{n}</span>
              <span className="fl-icon-chip" aria-hidden="true">{createElement(icon, { className: "h-5 w-5" })}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              <div className="fl-step-sample" aria-hidden="true">{sample}</div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

// Demonstrações baseadas nas telas reais do app (Neo, Biblioteca, Revisão, Speaking Lab).
const SHOWCASE = [
  {
    icon: MessageCircle,
    title: "Converse com o Neo, seu mentor de IA",
    text: "Pergunte como dizer algo, pratique situações do dia a dia e receba a forma mais natural, com exemplos e correções gentis.",
    demo: (
      <div className="fl-demo-chat">
        <p className="fl-bubble fl-bubble-user">How do I say “estou ansioso para isso”?</p>
        <p className="fl-bubble fl-bubble-ai">
          You can say: <b>I'm looking forward to it.</b>
          <br />
          <small>Ex.: I'm looking forward to the trip.</small>
        </p>
      </div>
    ),
  },
  {
    icon: BookMarked,
    title: "Sua biblioteca de MindBlocks",
    text: "Expressões úteis viram MindBlocks: blocos prontos com significado, exemplos e áudio, organizados em playlists.",
    demo: (
      <div className="fl-demo-blocks">
        {[
          ["I'm looking forward to it.", "Estou ansioso por isso."],
          ["Let me think it through.", "Deixa eu pensar melhor."],
          ["I'm getting used to it.", "Estou me acostumando."],
        ].map(([en, pt]) => (
          <div key={en} className="fl-demo-block">
            <span><b>{en}</b><small>{pt}</small></span>
            <Headphones className="h-4 w-4" aria-hidden="true" />
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: RefreshCw,
    title: "Revisão inteligente no momento certo",
    text: "Você responde, a IA corrige pelo sentido e o sistema agenda a próxima revisão para quando a memória começa a falhar.",
    demo: (
      <div className="fl-demo-review">
        <small>Como dizer em inglês?</small>
        <b>“eu trabalho no turno da noite”</b>
        <p className="fl-demo-verdict">Correto · I work the night shift.</p>
        <div className="fl-demo-buttons" aria-hidden="true">
          <span>Again</span><span>Hard</span><span className="on">Good</span><span>Easy</span>
        </div>
      </div>
    ),
  },
  {
    icon: Mic,
    title: "Speaking Lab: ouça, repita e fale",
    text: "Treine a fala com shadowing e respostas cronometradas. Você vê quais palavras saíram claras e quais precisam de mais prática.",
    demo: (
      <div className="fl-demo-speak">
        <p>
          <span className="ok">I</span> <span className="ok">work</span> <span className="ok">the</span>{" "}
          <span className="miss">night</span> <span className="ok">shift.</span>
        </p>
        <small>Clareza 86% · 128 palavras por minuto</small>
      </div>
    ),
  },
];

export function ProductShowcase() {
  return (
    <section id="recursos" className="fl-section fl-section-alt" aria-labelledby="fl-showcase-title">
      <div className="fl-container">
        <SectionHead
          id="fl-showcase-title"
          eyebrow="Conheça o FluentMind"
          title="Uma experiência de aprendizado feita para você."
          text="Demonstrações dos recursos disponíveis no app."
        />
        <div className="fl-showcase">
          {SHOWCASE.map(({ icon, title, text, demo }, index) => (
            <Reveal key={title} className={`fl-showcase-row ${index % 2 ? "is-reversed" : ""}`}>
              <div className="fl-showcase-copy">
                <span className="fl-icon-chip" aria-hidden="true">{createElement(icon, { className: "h-5 w-5" })}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              <div className="fl-showcase-demo" role="img" aria-label={`Demonstração: ${title}`}>
                <span className="fl-example-tag">Demonstração</span>
                {demo}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const AUDIENCE = [
  { icon: Plane, title: "Inglês para viagens", text: "Ganhe confiança em aeroportos, hotéis e situações do cotidiano." },
  { icon: Briefcase, title: "Inglês para carreira", text: "Pratique situações profissionais e desenvolva sua comunicação." },
  { icon: MessageCircle, title: "Inglês para conversação", text: "Melhore sua fluência praticando assuntos do seu interesse." },
  { icon: Clock, title: "Inglês no seu ritmo", text: "Estude de acordo com sua disponibilidade e seus objetivos." },
];

export function AudienceSection() {
  return (
    <section id="para-quem" className="fl-section" aria-labelledby="fl-audience-title">
      <div className="fl-container">
        <SectionHead id="fl-audience-title" eyebrow="Para quem é" title="Do seu objetivo para a sua rotina." />
        <div className="fl-audience">
          {AUDIENCE.map(({ icon, title, text }, index) => (
            <Reveal as="article" key={title} delay={index * 80} className="fl-audience-card">
              <span className="fl-icon-chip" aria-hidden="true">{createElement(icon, { className: "h-5 w-5" })}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCTA() {
  return (
    <section className="fl-container fl-section" aria-labelledby="fl-cta-title">
      <Reveal className="fl-cta">
        <h2 id="fl-cta-title">Seu próximo passo começa com uma conversa.</h2>
        <p>Transforme pequenos momentos de prática em mais confiança para se comunicar em inglês.</p>
        <Link to={APP_ROUTE} className="fl-btn fl-btn-light fl-btn-lg">
          Começar a praticar <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Reveal>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="fl-footer">
      <div className="fl-container fl-footer-inner">
        <div>
          <Logo />
        </div>
        <nav aria-label="Rodapé">
          {NAV.map((item) => (
            <a key={item.id} href={`#${item.id}`} onClick={(event) => { event.preventDefault(); scrollToSection(item.id); }}>
              {item.label}
            </a>
          ))}
          <Link to="/politica-de-privacidade">Política de privacidade</Link>
          <Link to="/termos-de-uso">Termos de uso</Link>
        </nav>
        <small>© {new Date().getFullYear()} FluentMind. Todos os direitos reservados.</small>
      </div>
    </footer>
  );
}
