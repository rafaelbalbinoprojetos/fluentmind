import React from "react";
import { PLAN_LIST } from "../data/plans.js";
import { formatCurrency } from "../utils/formatters.js";

export default function PremiumPlansModal({
  open,
  onClose,
  onSubscribe,
  subscribingPlanId = null,
  hasPremiumAccess = false,
  currentPlanId = "free",
  trialActive = false,
  trialEndsAt = null,
}) {
  if (!open) return null;

  const trialLabel =
    trialActive && trialEndsAt
      ? `Seu teste Premium está ativo até ${new Date(trialEndsAt).toLocaleDateString("pt-BR")}.`
      : "Comece agora com 7 dias gratuitos em qualquer plano.";

  const handleRootClick = () => {
    onClose?.();
  };

  const handleCloseClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClose?.();
  };

  const handleDialogClick = (event) => {
    event.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/70 px-4 py-10 backdrop-blur"
      onClick={handleRootClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plans-modal-title"
        className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-white/95 shadow-2xl dark:bg-slate-950"
        onClick={handleDialogClick}
      >
        <button
          type="button"
          onClick={handleCloseClick}
          className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-200/60 text-slate-600 transition hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-temaSky/40 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800"
          aria-label="Fechar planos"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
            <path strokeWidth="1.6" strokeLinecap="round" d="M6 6l12 12" />
            <path strokeWidth="1.6" strokeLinecap="round" d="M6 18L18 6" />
          </svg>
        </button>

        <div className="relative max-h-[min(90vh,720px)] overflow-y-auto px-8 py-12">
          <div className="grid gap-10 md:grid-cols-[1fr,1.2fr]">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-700 dark:bg-violet-900/40 dark:text-violet-200">
                Planos FluentMind
              </span>

              <div className="space-y-3">
                <h2 id="plans-modal-title" className="text-2xl font-semibold text-slate-900 dark:text-white">
                  Escolha o plano ideal para pensar em outro idioma
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Evolua de frases soltas para conversas com IA, revisão inteligente, áudio e biblioteca pessoal de expressões.
                </p>
              </div>

              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-xs text-violet-700 dark:border-violet-700/40 dark:bg-violet-900/30 dark:text-violet-200">
                <p className="font-semibold text-violet-800 dark:text-violet-100">Teste gratuito de 7 dias</p>
                <p className="mt-2 leading-relaxed">{trialLabel}</p>
                <p className="mt-3 text-[11px] text-violet-600/80 dark:text-violet-200/80">
                  Sem cartão até o fim do período de teste. Você só paga se decidir continuar.
                </p>
              </div>

              <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <p className="font-semibold uppercase tracking-[0.16em] text-slate-700 dark:text-slate-200">Pagamento automático</p>
                <p>Utilizamos o Mercado Pago para processar cobranças mensais. Você pode cancelar quando quiser direto pelo painel.</p>
              </div>
            </div>

            <div className="grid gap-4">
              {PLAN_LIST.map((plan) => {
                const isLoading = subscribingPlanId === plan.id;
                const priceLabel = `${formatCurrency(plan.price)}/mês`;
                const isCurrentPlan = currentPlanId === plan.id;
                const disableAction = isCurrentPlan || typeof onSubscribe !== "function";

                return (
                <div
                  key={plan.id}
                  className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm transition ${
                    plan.highlight
                      ? "border-violet-300/80 bg-gradient-to-br from-violet-50 via-white to-sky-50 dark:border-violet-500/40 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900"
                      : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -right-5 top-4 rotate-45 bg-violet-500 px-8 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white shadow-lg">
                      Mais popular
                    </span>
                  )}

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{plan.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{plan.description}</p>
                    </div>
                    <p className="text-2xl font-semibold text-violet-600 dark:text-violet-300">{priceLabel}</p>
                    <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <span className="mt-0.5 text-base leading-none text-sky-500 dark:text-sky-300">-</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSubscribe?.(plan.id)}
                    disabled={disableAction || isLoading}
                    className={`mt-4 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      disableAction
                        ? "cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        : "bg-gradient-to-r from-violet-500 to-sky-500 text-white shadow-lg shadow-violet-500/30 hover:from-violet-400 hover:to-sky-400 disabled:cursor-not-allowed disabled:opacity-75"
                    }`}
                  >
                    {isCurrentPlan
                      ? "Plano atual"
                      : isLoading
                        ? "Conectando ao Mercado Pago..."
                        : `Assinar ${plan.shortName}`}
                  </button>
                  {!disableAction && (
                    <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                      Cartão + Pix + Boleto
                    </p>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
