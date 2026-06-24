const PLACEHOLDER_REPLACEMENTS = {
  atividade: "playing soccer",
  atividades: "playing soccer",
  hobby: "playing guitar",
  hobbies: "playing guitar",
  comida: "pizza",
  comidas: "pizza",
  prato: "pizza",
  pratos: "pizza",
  nome: "John",
  pessoa: "John",
  cidade: "London",
  lugar: "the park",
  trabalho: "work",
  profissao: "teacher",
  profissão: "teacher",
};

export function normalizeMindBlockExpressionText(value) {
  return String(value || "")
    .replace(/\[([^\]]+)\]/g, (match, rawKey) => {
      const key = String(rawKey || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return PLACEHOLDER_REPLACEMENTS[key] || match.replace(/[[\]]/g, "");
    })
    .replace(/\s+/g, " ")
    .trim();
}
