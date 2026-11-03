import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listMindBlocks: vi.fn(),
  listCorrectedMistakes: vi.fn(),
  listReviewEvents: vi.fn(),
  getOrCreateLearningProfile: vi.fn(),
  listDailyActivity: vi.fn(),
}));
vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: () => ({ user: { id: "u1", email: "ana@x.com" }, userPreferences: {}, updateUserPreferences: vi.fn(() => Promise.resolve()) }),
}));
vi.mock("../NeuralBrain.jsx", () => ({ default: () => null }));
vi.mock("../../services/mindblocks.js", () => ({ listMindBlocks: mocks.listMindBlocks }));
vi.mock("../../services/correctedMistakes.js", () => ({ listCorrectedMistakes: mocks.listCorrectedMistakes }));
vi.mock("../../services/reviewEvents.js", () => ({ listReviewEvents: mocks.listReviewEvents }));
vi.mock("../../services/learningProgress.js", () => ({
  getOrCreateLearningProfile: mocks.getOrCreateLearningProfile,
  listDailyActivity: mocks.listDailyActivity,
  buildActivityByDate: (rows) => rows,
}));
import FluentMindDashboard from "../dashboard/FluentMindDashboard.jsx";

const openHome = () => render(<MemoryRouter><FluentMindDashboard /></MemoryRouter>);

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getOrCreateLearningProfile.mockResolvedValue({ display_name: "Ana", streak_days: 3 });
  mocks.listCorrectedMistakes.mockResolvedValue([]);
  mocks.listReviewEvents.mockResolvedValue([]);
  mocks.listDailyActivity.mockResolvedValue([]);
});

describe("Home", () => {
  it("recommends due reviews with a single primary CTA", async () => {
    mocks.listMindBlocks.mockResolvedValue([
      { id: "1", expression: "I'm on my way.", translation: "Estou a caminho.", isReviewDue: true },
      { id: "2", expression: "Nice to meet you.", isReviewDue: false },
    ]);
    openHome();

    expect(await screen.findByRole("heading", { name: "Lembrar 1 expressão antes de esquecer" })).toBeInTheDocument();
    const ctas = screen.getAllByRole("link", { name: /Continuar meu aprendizado/ });
    expect(ctas).toHaveLength(1);
    expect(ctas[0]).toHaveAttribute("href", "/daily-workout");
    expect(screen.getByText("I'm on my way.")).toBeInTheDocument();
    expect(screen.getByText("mede prática, não nível de inglês")).toBeInTheDocument();
  });

  it("keeps the data that loaded when one source fails", async () => {
    mocks.listMindBlocks.mockRejectedValue(new Error("offline"));
    openHome();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/expressões/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Boa (dia|tarde|noite), Ana|Bom dia, Ana/ })).toBeInTheDocument();
    expect(screen.getByText(/Suas expressões não carregaram/)).toBeInTheDocument();
    // Sem os MindBlocks, a recomendação segue a Jornada em vez de inventar revisões.
    expect(screen.getByRole("heading", { name: /Jornada|Continuar:/ })).toBeInTheDocument();
  });

  it("shows no invented data for a new student", async () => {
    mocks.listMindBlocks.mockResolvedValue([]);
    openHome();

    expect(await screen.findByText(/Você ainda não salvou expressões/)).toBeInTheDocument();
    expect(screen.queryByText("A2")).not.toBeInTheDocument();
    expect(screen.queryByText(/I'm looking forward to it/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Aprender a expressão de hoje/)).not.toBeInTheDocument();
  });

  it("disables the primary CTA until the recommendation is ready", async () => {
    let resolveBlocks;
    mocks.listMindBlocks.mockReturnValue(new Promise((resolve) => { resolveBlocks = resolve; }));
    mocks.getOrCreateLearningProfile.mockReturnValue(new Promise(() => {}));
    mocks.listCorrectedMistakes.mockReturnValue(new Promise(() => {}));
    openHome();

    expect(screen.getByRole("button", { name: /Continuar meu aprendizado/ })).toBeDisabled();
    resolveBlocks([]);
  });

  it("writes the review step as a learning goal and proposes a short session", async () => {
    mocks.listMindBlocks.mockResolvedValue([{ id: "1", expression: "I'm on my way.", isReviewDue: true }]);
    openHome();

    expect(await screen.findByRole("heading", { name: "Lembrar 1 expressão antes de esquecer" })).toBeInTheDocument();
    expect(screen.getByText(/Sessão curta de revisão/)).toBeInTheDocument();
    expect(screen.queryByText(/min\b/)).not.toBeInTheDocument();
  });

  it("makes each pending mission row a link to where it is done", async () => {
    mocks.listMindBlocks.mockResolvedValue([]);
    openHome();

    const row = await screen.findByRole("link", { name: /Praticar com o Neo: 0 de 5/ });
    expect(row).toHaveAttribute("href", "/neo");
    expect(screen.getByRole("link", { name: /Fazer 1 revisão: 0 de 1/ })).toHaveAttribute("href", "/daily-workout");
  });

  it("lists the real daily missions in Portuguese", async () => {
    mocks.listMindBlocks.mockResolvedValue([]);
    openHome();

    expect(await screen.findByText("Fazer 1 revisão")).toBeInTheDocument();
    expect(screen.getByText("Praticar com o Neo")).toBeInTheDocument();
    expect(screen.getByText("0 de 3 feitas")).toBeInTheDocument();
  });
});
