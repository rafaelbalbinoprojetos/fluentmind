import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: null, createMindBlock: vi.fn(), listMindBlocks: vi.fn(), check: vi.fn() }));
vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => ({ user: mocks.user, session: { access_token: "t" } }) }));
vi.mock("../../services/learningEventEngine.js", () => ({ recordLearningEvent: vi.fn() }));
vi.mock("../../services/mindblocks.js", () => ({ createMindBlock: mocks.createMindBlock, listMindBlocks: mocks.listMindBlocks }));
vi.mock("../../services/answerCheck.js", async (importOriginal) => ({ ...(await importOriginal()), checkAnswerWithAi: mocks.check }));
vi.mock("react-hot-toast", () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), custom: vi.fn(), dismiss: vi.fn() }) }));
import LearningJourneyPage from "../LearningJourney.jsx";
import { addXp, getProgressionState, updateProgressionState } from "../../services/progressionEngine.js";
import { buildChoose, buildClozeItems, JOURNEY_ACTIVITIES } from "../../services/journeyEngine.js";
import { learningJourneyChapters } from "../../data/learningJourney.js";

const aboutMe = learningJourneyChapters[0];
const openPage = (url = "/learning-journey") => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/learning-journey" element={<LearningJourneyPage />} /></Routes>
  </MemoryRouter>,
);
const chapterState = () => getProgressionState().learningJourney?.chapterProgress?.["about-me"] || {};
const seedJourney = (journey) => updateProgressionState((state) => ({ ...state, learningJourney: { activeChapterId: "about-me", completedChapterIds: [], ...journey } }));

beforeEach(() => {
  localStorage.clear();
  mocks.user = null;
  vi.clearAllMocks();
  mocks.listMindBlocks.mockResolvedValue([]);
});

describe("Journey 2.0 navigation", () => {
  it("shows one activity at a time and marks reading only when the student moves on", () => {
    openPage();
    expect(screen.getByRole("heading", { name: "O que você vai aprender" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Expressões do capítulo" })).not.toBeInTheDocument();
    expect(chapterState().lesson).toBeFalsy();

    fireEvent.click(screen.getByRole("button", { name: /Continuar: Expressões do capítulo/ }));
    expect(screen.getByRole("heading", { name: "Expressões do capítulo" })).toBeInTheDocument();
    expect(chapterState().lesson).toBe(true);
    expect(chapterState().activities.lesson.status).toBe("viewed");

    // Outra gravação (XP de outra tela) não desfaz o progresso.
    act(() => { addXp(5, "outra tela"); });
    expect(chapterState().lesson).toBe(true);
  });

  it("resumes the last activity after leaving the page", () => {
    const { unmount } = openPage();
    fireEvent.click(screen.getByRole("button", { name: /Continuar: Expressões/ }));
    fireEvent.click(screen.getByRole("button", { name: /Continuar: Em situações reais/ }));
    unmount();
    openPage();
    expect(screen.getByRole("heading", { name: "Em situações reais" })).toBeInTheDocument();
  });

  it("keeps locked chapters closed even when requested by URL", () => {
    openPage("/learning-journey?chapter=travel&activity=lesson");
    expect(screen.getByRole("heading", { name: /Capítulo 1: About Me/ })).toBeInTheDocument();
    const map = screen.getByRole("navigation", { name: "Capítulos da Jornada" });
    expect(within(map).getByRole("button", { name: /Travel.*bloqueado/ })).toHaveAttribute("aria-disabled", "true");
  });
});

describe("Journey 2.0 activities", () => {
  it("grades a closed quiz locally and gives XP only once", () => {
    const xpBefore = getProgressionState().totalXp;
    openPage("/learning-journey?chapter=about-me&activity=choose");
    const questions = buildChoose(aboutMe);
    questions.forEach((question, index) => {
      fireEvent.click(screen.getByRole("button", { name: question.options[question.answer] }));
      expect(screen.getByText("Isso!")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: index === questions.length - 1 ? "Ver resultado" : "Próxima pergunta" }));
    });
    expect(chapterState().activities.choose).toMatchObject({ status: "correct", score: questions.length, total: questions.length });
    expect(chapterState().mistakes).toBe(true);
    const xpAfterFirst = getProgressionState().totalXp;
    expect(xpAfterFirst - xpBefore).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: "Refazer" }));
    questions.forEach((question, index) => {
      fireEvent.click(screen.getByRole("button", { name: question.options[question.answer] }));
      fireEvent.click(screen.getByRole("button", { name: index === questions.length - 1 ? "Ver resultado" : "Próxima pergunta" }));
    });
    expect(getProgressionState().totalXp).toBe(xpAfterFirst);
  });

  it("records a wrong first answer as attempted, not correct", () => {
    openPage("/learning-journey?chapter=about-me&activity=choose");
    const questions = buildChoose(aboutMe);
    questions.forEach((question, index) => {
      const wrong = question.options.find((_, optionIndex) => optionIndex !== question.answer);
      fireEvent.click(screen.getByRole("button", { name: index === 0 ? wrong : question.options[question.answer] }));
      fireEvent.click(screen.getByRole("button", { name: index === questions.length - 1 ? "Ver resultado" : "Próxima pergunta" }));
    });
    expect(chapterState().activities.choose).toMatchObject({ status: "attempted", score: questions.length - 1 });
  });

  it("checks the cloze with the exact chapter expression and reveals it after two misses", () => {
    openPage("/learning-journey?chapter=about-me&activity=cloze");
    const [first] = buildClozeItems(aboutMe);
    const blank = screen.getByRole("textbox", { name: "Complete a fala" });
    fireEvent.change(blank, { target: { value: "I am of" } });
    fireEvent.click(screen.getByRole("button", { name: "Conferir" }));
    expect(screen.getByText(/Ainda não/)).toBeInTheDocument();
    fireEvent.change(blank, { target: { value: "still wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Conferir" }));
    expect(screen.getByText(/A expressão era/)).toBeInTheDocument();
    expect(blank).toHaveValue(first.answer);
  });

  it("uses the AI check for recall and never shows the answer before the attempt", async () => {
    mocks.check.mockResolvedValue({ verdict: "almost", feedback: "Faltou o artigo.", corrected: "My name is Ana." });
    openPage("/learning-journey?chapter=about-me&activity=recall");
    expect(screen.queryByText("My name is Ana.")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /Como você diz isso em inglês/ }), { target: { value: "My name Ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Corrigir" }));
    expect(await screen.findByText("Quase")).toBeInTheDocument();
    expect(mocks.check).toHaveBeenCalledWith(expect.objectContaining({ mode: "translate", answer: "My name Ana", accessToken: "t" }));
  });

  it("shows an error and approves nothing when the AI check fails", async () => {
    mocks.check.mockRejectedValue(new Error("offline"));
    openPage("/learning-journey?chapter=about-me&activity=challenge");
    fireEvent.change(screen.getByRole("textbox", { name: "Sua resposta em inglês" }), { target: { value: "My name is Ana." } });
    fireEvent.click(screen.getByRole("button", { name: "Corrigir" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível corrigir agora/);
    expect(chapterState().activities?.challenge).toBeUndefined();
  });

  it("saves chapter expressions to review without duplicating existing ones", async () => {
    mocks.user = { id: "student" };
    mocks.listMindBlocks.mockResolvedValue([{ expression: "I'm from Brazil." }]);
    mocks.createMindBlock.mockImplementation(async (payload) => ({ id: payload.expression, ...payload }));
    openPage("/learning-journey?chapter=about-me&activity=expressions");
    fireEvent.click(screen.getByRole("button", { name: "Salvar na revisão" }));
    await waitFor(() => expect(chapterState().mindblocks).toBe(true));
    expect(mocks.createMindBlock).toHaveBeenCalledTimes(aboutMe.mindBlocks.length - 1);
    expect(mocks.createMindBlock.mock.calls.map(([payload]) => payload.expression)).not.toContain("I'm from Brazil.");
  });
});

describe("Journey 2.0 chapter completion", () => {
  const allDone = () => Object.fromEntries(JOURNEY_ACTIVITIES.map((activity) => [
    activity.id,
    { status: activity.id === "challenge" ? "demonstrated" : activity.id === "conversation" ? "correct" : "attempted" },
  ]));

  it("blocks completion until the challenge is demonstrated", () => {
    const activities = allDone();
    activities.challenge = { status: "attempted" };
    seedJourney({ chapterProgress: { "about-me": { activities } } });
    openPage("/learning-journey?chapter=about-me&activity=challenge");
    expect(screen.getByRole("button", { name: /Concluir capítulo/ })).toBeDisabled();
    expect(screen.getByText(/Faltam: Desafio final/)).toBeInTheDocument();
  });

  it("completes once, unlocks the next chapter and celebrates", () => {
    seedJourney({ chapterProgress: { "about-me": { activities: allDone() } } });
    const xpBefore = getProgressionState().totalXp;
    openPage("/learning-journey?chapter=about-me&activity=challenge");
    fireEvent.click(screen.getByRole("button", { name: /Concluir capítulo/ }));

    expect(screen.getByRole("heading", { name: "About Me: missão cumprida" })).toBeInTheDocument();
    const journey = getProgressionState().learningJourney;
    expect(journey.completedChapterIds).toEqual(["about-me"]);
    expect(journey.activeChapterId).toBe("daily-routine");
    expect(getProgressionState().totalXp - xpBefore).toBe(aboutMe.xp);
    expect(screen.getByRole("button", { name: /Começar o capítulo 2/ })).toBeInTheDocument();
  });

  it("keeps legacy marks from the old Journey as done", () => {
    seedJourney({ chapterProgress: { "about-me": { lesson: true, vocabulary: true, examples: true } } });
    openPage();
    expect(screen.getByRole("heading", { name: "Entendi o diálogo?" })).toBeInTheDocument();
  });
});

describe("Journey 2.1 navigation and completion", () => {
  it("shows the five phases with progress and readable activity names (no tiny dots)", () => {
    openPage();
    const nav = screen.getByRole("navigation", { name: "Atividades do capítulo" });
    for (const phase of ["Descobrir", "Compreender", "Recuperar", "Conversar", "Demonstrar"]) {
      expect(within(nav).getByRole("button", { name: new RegExp(phase) })).toBeInTheDocument();
    }
    expect(within(nav).getByRole("button", { name: /O que você vai aprender.*Atual/ })).toHaveAttribute("aria-current", "step");
    fireEvent.click(within(nav).getByRole("button", { name: /Recuperar/ }));
    fireEvent.click(within(nav).getByRole("button", { name: /Complete a conversa/ }));
    expect(screen.getByRole("heading", { name: "Complete a conversa" })).toBeInTheDocument();
  });

  it("never shows a viewed activity as approved", () => {
    seedJourney({ chapterProgress: { "about-me": { activities: { lesson: { status: "viewed" }, choose: { status: "correct", score: 4, total: 4 } } } } });
    openPage("/learning-journey?chapter=about-me&activity=expressions");
    const nav = screen.getByRole("navigation", { name: "Atividades do capítulo" });
    expect(within(nav).getByRole("button", { name: /O que você vai aprender.*Visto/ })).toBeInTheDocument();
    fireEvent.click(within(nav).getByRole("button", { name: /Compreender/ }));
    expect(within(nav).getByRole("button", { name: /Escolha a frase certa.*Correto/ })).toBeInTheDocument();
  });

  it("marks chapters finished in the old Journey without inventing evaluations", () => {
    seedJourney({ activeChapterId: "daily-routine", completedChapterIds: ["about-me"], chapterProgress: { "about-me": { lesson: true, vocabulary: true, challenge: true } } });
    openPage("/learning-journey?chapter=about-me");
    expect(screen.getByText(/concluído na versão anterior/)).toBeInTheDocument();
    expect(screen.queryByText(/missão cumprida/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Praticar com a nova Jornada/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Começar o capítulo 2/ })).toBeInTheDocument();
  });

  it("shows chapter, goal, real progress and the next action in the header", () => {
    openPage();
    expect(screen.getByRole("img", { name: "0 de 11 atividades do capítulo concluídas" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Próxima ação/ }));
    expect(screen.getByRole("heading", { name: "O que você vai aprender" })).toBeInTheDocument();
  });
});
