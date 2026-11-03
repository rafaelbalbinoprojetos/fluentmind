// @vitest-environment node
// TESTE OPCIONAL COM IA REAL — desativado por padrão. Faz chamadas PAGAS ao provedor.
// Só roda com autorização explícita:
//   RUN_LIVE_AI=1 LIVE_AI_MAX_CALLS=6 OPENAI_API_KEY=... npx vitest run tests/live
// Limites:
//   - LIVE_AI_MAX_CALLS (obrigatório, máx. 20): nº máximo de chamadas; os casos excedentes são pulados.
//   - Cada caso faz 1 chamada a /api/review-check (sem cache entre casos: respostas diferentes).
//   - LIVE_AI_MIN_AGREEMENT (padrão 0.7): fração mínima de casos em que a IA concorda com o esperado.
// O resultado (concordância, tokens e latência) é impresso para calibrar os parâmetros pedagógicos.
import { describe, expect, it, vi } from "vitest";
import { answerCases, challengeCriteria } from "../fixtures/evaluationCases.js";

const enabled = process.env.RUN_LIVE_AI === "1" && Number(process.env.LIVE_AI_MAX_CALLS) > 0;
const maxCalls = Math.min(20, Number(process.env.LIVE_AI_MAX_CALLS) || 0);

vi.mock("../../api/_utils/auth.js", () => ({ requireUser: async () => ({ id: "live-evaluation" }) }));
vi.mock("../../api/_utils/aiUsage.js", () => ({ reserveAiUsage: async () => undefined }));

describe.skipIf(!enabled)("live AI calibration (paid, opt-in)", () => {
  it(`evaluates up to ${maxCalls} cases and reports agreement`, async () => {
    const { default: handler } = await import("../../api/review-check.js");
    const cases = answerCases.slice(0, maxCalls);
    const results = [];
    for (const item of cases) {
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), setHeader: vi.fn() };
      await handler({
        method: "POST",
        body: { mode: "challenge", prompt: "Apresente-se em 4 frases curtas.", answer: item.answer, criteria: challengeCriteria, difficulty: "Beginner" },
      }, res);
      const payload = res.json.mock.calls[0]?.[0] || {};
      results.push({
        case: item.category,
        expectedPassed: item.expect.passed,
        passed: payload.passed,
        assessment: payload.assessment,
        agree: payload.passed === item.expect.passed,
        ms: payload.evaluationMeta?.ms,
        tokens: (payload.evaluationMeta?.promptTokens || 0) + (payload.evaluationMeta?.completionTokens || 0),
      });
    }
    console.table(results);
    const agreement = results.filter((item) => item.agree).length / Math.max(1, results.length);
    console.info(`Concordância: ${(agreement * 100).toFixed(0)}% em ${results.length} chamadas; tokens: ${results.reduce((sum, item) => sum + item.tokens, 0)}`);
    expect(agreement).toBeGreaterThanOrEqual(Number(process.env.LIVE_AI_MIN_AGREEMENT) || 0.7);
  }, 120_000);
});
