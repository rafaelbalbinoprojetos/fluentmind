import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: null, createMindBlock: vi.fn(), check: vi.fn() }));
vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => ({ user: mocks.user, session: { access_token: "t" } }) }));
vi.mock("../../services/learningEventEngine.js", () => ({ recordLearningEvent: vi.fn() }));
vi.mock("../../services/mindblocks.js", () => ({ createMindBlock: mocks.createMindBlock }));
vi.mock("../../services/answerCheck.js", () => ({ checkAnswerWithAi: mocks.check }));
vi.mock("react-hot-toast", () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), custom: vi.fn(), dismiss: vi.fn() }) }));
import LearningJourneyPage from "../LearningJourney.jsx";
import { addXp, getProgressionState } from "../../services/progressionEngine.js";

const openPage = () => render(<MemoryRouter><LearningJourneyPage /></MemoryRouter>);

beforeEach(() => {
  localStorage.clear();
  mocks.user = null;
  vi.clearAllMocks();
});

describe("Learning Journey steps", () => {
  it("keeps a marked step after the XP write and shows it as done", () => {
    openPage();
    fireEvent.click(screen.getByRole("button", { name: "Marcar vocabulário concluído" }));

    expect(screen.queryByRole("button", { name: "Marcar vocabulário concluído" })).not.toBeInTheDocument();
    expect(getProgressionState().learningJourney.chapterProgress["about-me"].vocabulary).toBe(true);

    // Outra gravação de progresso (XP de outra tela) não pode desfazer a marcação.
    act(() => { addXp(5, "outra tela"); });
    expect(getProgressionState().learningJourney.chapterProgress["about-me"].vocabulary).toBe(true);
    expect(screen.queryByRole("button", { name: "Marcar vocabulário concluído" })).not.toBeInTheDocument();
  });

  it("records two steps from one click without losing the first", () => {
    openPage();
    fireEvent.click(screen.getByRole("button", { name: "Marcar escuta concluída" }));
    const chapter = getProgressionState().learningJourney.chapterProgress["about-me"];
    expect(chapter.listening).toBe(true);
    expect(chapter.review).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Marcar exemplos lidos" }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar erros estudados" }));
    expect(screen.getAllByRole("status").length).toBeGreaterThanOrEqual(3);
  });
});

describe("Learning Journey practice drills", () => {
  it("corrects the student's sentence and saves the corrected version as a MindBlock", async () => {
    mocks.user = { id: "student" };
    mocks.check.mockResolvedValue({ verdict: "almost", feedback: "Falta o verbo.", corrected: "My name is Ana." });
    mocks.createMindBlock.mockResolvedValue({ id: "new" });
    openPage();

    fireEvent.change(screen.getByRole("textbox", { name: "Resposta: Exercício 1" }), { target: { value: "My name Ana." } });
    fireEvent.click(screen.getAllByRole("button", { name: "Corrigir" })[0]);
    expect(await screen.findByText("My name is Ana.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Eu acordo às 6/), { target: { value: "Meu nome é Ana." } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar como MindBlock" }));
    await waitFor(() => expect(mocks.createMindBlock).toHaveBeenCalledWith(
      expect.objectContaining({ expression: "My name is Ana.", translation: "Meu nome é Ana." }),
      { userId: "student", mode: "review" },
    ));
    expect(await screen.findByText(/Salva: “My name is Ana.”/)).toBeInTheDocument();
    expect(getProgressionState().learningJourney.chapterProgress["about-me"].practice).toBe(true);
  });
});
