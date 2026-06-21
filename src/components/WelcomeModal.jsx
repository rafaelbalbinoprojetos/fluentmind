import React from "react";

export default function WelcomeModal({ open, onStart, onClose }) {
  if (!open) return null;

  const handleRootClick = () => {
    onClose?.();
  };

  const handleDialogClick = (event) => {
    event.stopPropagation();
  };

  const handleCloseClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/70 px-4 py-10 backdrop-blur"
      onClick={handleRootClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-violet-950 to-sky-950 text-white shadow-2xl shadow-violet-500/20"
        onClick={handleDialogClick}
      >
        <button
          type="button"
          onClick={handleCloseClick}
          className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          aria-label="Fechar boas-vindas"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
            <path strokeWidth="1.6" strokeLinecap="round" d="M6 6l12 12" />
            <path strokeWidth="1.6" strokeLinecap="round" d="M6 18L18 6" />
          </svg>
        </button>

        <div className="relative max-h-[min(90vh,640px)] overflow-y-auto px-8 py-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">
            Bem-vindo
          </span>

          <div className="mt-6 space-y-3">
            <h2 id="welcome-modal-title" className="text-2xl font-semibold leading-tight text-white">
              Bem-vindo ao FluentMind!
            </h2>
            <p className="text-sm text-sky-100/80">
              Voce esta no plano gratuito. Aproveite 7 dias de teste com conversas de IA, transcricao por voz,
              playlists de frases, revisao inteligente e historico de aprendizado.
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-sky-50/80">
            <p className="font-medium text-sky-100">Durante o teste gratuito voce:</p>
            <ul className="mt-3 space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-base leading-none">-</span>
                <span>Pratica conversas guiadas com IA e envia respostas por voz.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-base leading-none">-</span>
                <span>Salva expressoes uteis e monta playlists por situacao.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-base leading-none">-</span>
                <span>Transforma erros corrigidos em revisoes inteligentes.</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onStart}
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:from-violet-400 hover:to-sky-400 sm:w-auto"
            >
              Comecar agora
            </button>
          </div>

          <p className="mt-6 text-center text-[11px] text-sky-100/70">
            Experimente o fluxo inicial e acompanhe as proximas evolucoes do FluentMind.
          </p>
        </div>
      </div>
    </div>
  );
}
