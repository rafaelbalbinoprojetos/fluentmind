export const DEFAULT_PLAN_ID = "premium";

export const PLAN_DETAILS = {
  basic: {
    id: "basic",
    name: "Plano Básico",
    shortName: "Básico",
    description: "Essencial para salvar expressoes e manter uma rotina simples de estudo.",
    price: 7.9,
    currency: "BRL",
    highlight: false,
    reason: "Assinatura FluentMind Básico",
    trialDays: 7,
    features: [
      "Biblioteca de expressoes ilimitada",
      "Playlists por tema, situacao e objetivo",
      "Revisoes basicas para fixacao",
      "Historico simples de pratica",
    ],
  },
  premium: {
    id: "premium",
    name: "Plano Premium",
    shortName: "Premium",
    description: "Experiencia completa com IA, audio, revisoes inteligentes e evolucao pessoal.",
    price: 13.9,
    currency: "BRL",
    highlight: true,
    reason: "Assinatura FluentMind Premium",
    trialDays: 7,
    features: [
      "Conversas com IA para praticar situacoes reais",
      "Transcricao de voz e pratica por audio",
      "Revisao inteligente de expressoes e erros corrigidos",
      "Playlists avancadas para shadowing e repeticao",
      "Progresso pessoal com insights automaticos",
    ],
  },
};

export const PLAN_LIST = Object.values(PLAN_DETAILS);
