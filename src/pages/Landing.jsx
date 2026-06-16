import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import PremiumPlansModal from "../components/PremiumPlansModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { openMercadoPagoCheckout } from "../lib/mercadoPago.js";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const CHECKOUT_ENDPOINT = `${API_BASE}/api/mercadopago/checkout`;
const MERCADO_PAGO_PUBLIC_KEY = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY ?? "";
const MERCADO_PAGO_LOCALE = import.meta.env.VITE_MERCADOPAGO_LOCALE ?? "pt-BR";
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1800&q=85";

const HOW_IT_WORKS = [
  {
    title: "Converse com IA",
    description: "Pratique situacoes reais sem traduzir palavra por palavra.",
  },
  {
    title: "Salve expressoes",
    description: "Transforme frases uteis em uma biblioteca pessoal.",
  },
  {
    title: "Revise no tempo certo",
    description: "Reforce erros corrigidos, audio e playlists de frases.",
  },
];

const OUTCOMES = [
  "Responder com mais naturalidade",
  "Pensar em ingles durante a conversa",
  "Revisar expressoes que voce realmente usa",
  "Acompanhar sua evolucao semanal",
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, subscription } = useAuth();
  const [plansOpen, setPlansOpen] = useState(false);
  const [subscribingPlanId, setSubscribingPlanId] = useState(null);

  const {
    plan = "free",
    trialActive = false,
    trialEndsAt = null,
    hasPremiumAccess = false,
  } = subscription ?? {};

  const handleOpenPlans = () => setPlansOpen(true);
  const handleClosePlans = () => {
    setPlansOpen(false);
    setSubscribingPlanId(null);
  };

  const handleSubscribe = async (planId) => {
    if (!user?.id || !user?.email) {
      toast.error("Faça login para assinar o plano Premium.");
      navigate("/app", { replace: false, state: { from: "/dashboard" } });
      return;
    }

    setSubscribingPlanId(planId);

    try {
      const response = await fetch(CHECKOUT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planId,
          userId: user.id,
          email: user.email,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível iniciar o checkout.");
      }

      const preferenceId = data?.preferenceId || data?.id || data?.preference_id || data?.preference?.id;
      const checkoutUrl = data?.checkoutUrl || data?.init_point || data?.sandbox_init_point || data?.url;

      let openedViaPopup = false;
      if (preferenceId && MERCADO_PAGO_PUBLIC_KEY) {
        try {
          await openMercadoPagoCheckout({
            publicKey: MERCADO_PAGO_PUBLIC_KEY,
            preferenceId,
            locale: MERCADO_PAGO_LOCALE,
            theme: {
              elementsColor: "#6366f1",
              headerColor: "#4f46e5",
            },
          });
          openedViaPopup = true;
        } catch (sdkError) {
          console.error("Popup do Mercado Pago indisponível:", sdkError);
        }
      }

      if (!openedViaPopup) {
        if (!checkoutUrl) {
          throw new Error("Mercado Pago indisponível no momento.");
        }
        window.open(checkoutUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Não foi possível iniciar o checkout.");
    } finally {
      setSubscribingPlanId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-sky-500 text-sm font-bold text-white">
              FM
            </span>
            <span>
              <span className="block text-lg font-semibold text-white">FluentMind</span>
              <span className="block text-xs text-sky-100/70">Stop translating. Start thinking.</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/app"
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
            >
              Entrar
            </Link>
            <button
              type="button"
              onClick={handleOpenPlans}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-violet-400 hover:to-sky-400"
            >
              Ver planos
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative flex min-h-[92vh] items-end overflow-hidden px-4 pb-14 pt-28">
          <img
            src={HERO_IMAGE}
            alt="Pessoa estudando idioma em notebook com fones de ouvido"
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-violet-950/70 to-sky-950/40" />
          <div className="relative mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.1fr,0.75fr] lg:items-end">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-sky-300/30 bg-sky-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
                Aprenda por conversa
              </span>
              <h1 className="mt-6 text-4xl font-semibold leading-tight text-white sm:text-6xl">
                FluentMind
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-200">
                Stop translating. Start thinking. Pratique ingles e outros idiomas com IA, salve expressoes uteis,
                revise seus erros e acompanhe sua evolucao.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/app"
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-950/40 transition hover:from-violet-400 hover:to-sky-400"
                >
                  Comecar agora
                </Link>
                <a
                  href="#como-funciona"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Ver como funciona
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">Hoje no FluentMind</p>
              <div className="mt-4 space-y-3">
                {["Nova conversa sobre viagens", "8 expressoes para revisar", "Playlist: small talk no trabalho"].map((item) => (
                  <div key={item} className="rounded-xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-100">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-4 md:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h2 className="text-lg font-semibold text-white">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-800 bg-slate-900/40">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 lg:grid-cols-[0.8fr,1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">Evolucao pessoal</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Aprender fica mais claro quando cada frase vira pratica.</h2>
            </div>
            <ul className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              {OUTCOMES.map((item) => (
                <li key={item} className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="rounded-3xl border border-violet-400/20 bg-gradient-to-r from-violet-950/80 to-sky-950/70 p-8">
            <div className="grid gap-6 md:grid-cols-[1fr,auto] md:items-center">
              <div>
                <h2 className="text-2xl font-semibold text-white">Comece com uma conversa real.</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Entre, pratique por alguns minutos e salve as primeiras expressoes na sua biblioteca.
                </p>
              </div>
              <Link
                to="/app"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Criar conta gratuita
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PremiumPlansModal
        open={plansOpen}
        onClose={handleClosePlans}
        onSubscribe={handleSubscribe}
        subscribingPlanId={subscribingPlanId}
        hasPremiumAccess={hasPremiumAccess}
        currentPlanId={plan}
        trialActive={trialActive}
        trialEndsAt={trialEndsAt}
      />
    </div>
  );
}
