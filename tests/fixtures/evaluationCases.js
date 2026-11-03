// Bateria de casos de avaliação pedagógica.
// "model" é a saída simulada do modelo (mocks). "expect" é o que a política deve concluir.
// Os mesmos casos (answer/message) alimentam o teste opcional com IA real (tests/live).

export const challengeCriteria = [
  { text: "Diz o nome com \"My name is\" ou \"I'm\"", essential: true },
  { text: "Diz a origem com \"I'm from\"", essential: true },
  { text: "Fala do trabalho ou estudo", essential: false },
  { text: "Frases gramaticais e naturais", essential: false },
];

const all = (status) => challengeCriteria.map((item) => ({ criterion: item.text, status }));
const statuses = (...list) => challengeCriteria.map((item, index) => ({ criterion: item.text, status: list[index] }));

export const answerCases = [
  {
    name: "resposta correta alternativa (contrações e ordem diferente)",
    category: "alternative",
    answer: "Hi! I'm Ana, I'm from Recife, Brazil, and I'm a nurse. I really like music.",
    model: { score: 92, verdict: "correct", onTopic: true, confidence: "high", criteria: all("met") },
    expect: { assessment: "correct", passed: true },
  },
  {
    name: "erro leve que preserva o sentido",
    category: "light-error",
    answer: "My name is Ana. I am from Brazil. I work in a hospital. I like the music.",
    model: { score: 72, verdict: "almost", onTopic: true, confidence: "high", criteria: statuses("met", "met", "met", "partial") },
    expect: { assessment: "almost", passed: true },
  },
  {
    name: "erro grave em critério essencial",
    category: "severe-error",
    answer: "Name Ana. I Brazil. Work hospital.",
    model: { score: 35, verdict: "wrong", onTopic: true, confidence: "high", criteria: statuses("partial", "not_met", "partial", "not_met") },
    expect: { assessment: "wrong", passed: false },
  },
  {
    name: "resposta fora do contexto",
    category: "off-topic",
    answer: "Pizza is my favorite food and I like football.",
    model: { score: 60, verdict: "correct", onTopic: false, confidence: "high", criteria: statuses("not_met", "not_met", "not_met", "met") },
    expect: { assessment: "wrong", passed: false },
  },
  {
    name: "só palavras-chave, sem frase",
    category: "keywords",
    answer: "name, from, Brazil, work",
    model: { score: 20, verdict: "wrong", onTopic: true, confidence: "high", criteria: all("not_met") },
    expect: { assessment: "wrong", passed: false },
  },
  {
    name: "resposta ambígua (baixa confiança)",
    category: "ambiguous",
    answer: "eu sou Ana from",
    model: { score: 50, verdict: "almost", onTopic: true, confidence: "low", criteria: all("partial") },
    expect: { assessment: "inconclusive", passed: false },
  },
  {
    name: "falha de formato (critério com status inválido)",
    category: "format",
    answer: "My name is Ana and I'm from Brazil.",
    model: { score: 80, verdict: "correct", criteria: [{ criterion: "x", status: "great" }] },
    expect: { assessment: "inconclusive", passed: false },
  },
  {
    name: "inconsistente: \"correct\" com critério essencial não atendido",
    category: "inconsistent",
    answer: "My name is Ana. I work in a hospital. I like music.",
    model: { score: 85, verdict: "correct", onTopic: true, confidence: "high", criteria: statuses("met", "not_met", "met", "met") },
    expect: { assessment: "almost", passed: false },
  },
  {
    name: "essenciais atendidos, mas abaixo da pontuação mínima",
    category: "threshold",
    answer: "My name Ana. I from Brazil.",
    model: { score: 55, verdict: "almost", onTopic: true, confidence: "high", criteria: statuses("partial", "partial", "not_met", "not_met") },
    expect: { assessment: "almost", passed: false },
  },
];

export const missionTargets = ["I'm from Brazil.", "I work in technology.", "Nice to meet you."];

const target = (expression, fields) => ({ expression, confidence: "high", feedback: "", suggestion: "", ...fields });

export const targetCases = [
  {
    name: "uso adequado e autônomo",
    category: "alternative",
    message: "Nice to meet you too! I'm from Brazil, from Belo Horizonte.",
    model: { targets: [target(missionTargets[0], { status: "adequate", impact: "none", autonomous: true })] },
    expect: ["adequate"],
  },
  {
    name: "erro leve vira parcial",
    category: "light-error",
    message: "I work in the technology since 2019.",
    model: { targets: [target(missionTargets[1], { status: "adequate", impact: "minor", autonomous: true })] },
    expect: ["partial"],
  },
  {
    name: "erro que muda o sentido não é aprovado",
    category: "severe-error",
    message: "I'm from technology.",
    model: { targets: [target(missionTargets[0], { status: "partial", impact: "blocks", autonomous: true })] },
    expect: ["inadequate"],
  },
  {
    name: "cópia da fala do tutor não é uso independente",
    category: "copied",
    message: "Nice to meet you.",
    model: { targets: [target(missionTargets[2], { status: "adequate", impact: "none", autonomous: false })] },
    expect: ["partial"],
  },
  {
    name: "avaliação ambígua",
    category: "ambiguous",
    message: "from Brazil maybe",
    model: { targets: [target(missionTargets[0], { status: "partial", impact: "minor", autonomous: true, confidence: "low" })] },
    expect: ["inconclusive"],
  },
  {
    name: "falha de formato",
    category: "format",
    model: { targets: [{ expression: missionTargets[0], status: "great" }] },
    message: "I'm from Brazil.",
    expect: ["inconclusive"],
  },
  {
    name: "inconsistente: aprovado sem informar impacto",
    category: "inconsistent",
    message: "I'm from Brazil.",
    model: { targets: [target(missionTargets[0], { status: "adequate", autonomous: true, impact: undefined })] },
    expect: ["inconclusive"],
  },
];
