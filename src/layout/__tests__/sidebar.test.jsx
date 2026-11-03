import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../context/AuthContext.jsx", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "ana@x.com", user_metadata: {} },
    session: { access_token: "t" },
    signOut: vi.fn(),
    updateUserMetadata: vi.fn(),
    updateUserPreferences: vi.fn(() => Promise.resolve()),
    userPreferences: { extra: { welcomeSeen: true } },
    subscription: null,
    startTrial: vi.fn(),
  }),
}));
vi.mock("../../components/SettingsMenu.jsx", () => ({ default: () => null }));
vi.mock("../../components/WelcomeModal.jsx", () => ({ default: () => null }));
vi.mock("../../components/VoiceRecordingModal.jsx", () => ({ default: () => null }));
vi.mock("../../components/PageTransition.jsx", () => ({ default: ({ children }) => children ?? null }));
import Layout from "../Layout.jsx";

const openLayout = () => render(
  <MemoryRouter initialEntries={["/dashboard"]}>
    <Routes>
      <Route element={<Layout />}>
        <Route path="dashboard" element={<p>Home</p>} />
      </Route>
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});

describe("collapsible sidebar", () => {
  it("starts expanded, collapses to icons without losing links and remembers the choice", () => {
    const { unmount } = openLayout();
    const sidebar = screen.getByRole("navigation", { name: "Menu principal" });
    const toggle = screen.getByRole("button", { name: /Recolher menu/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const linksBefore = sidebar.querySelectorAll("a").length;

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /Expandir menu/ })).toHaveAttribute("aria-expanded", "false");
    expect(sidebar).toHaveAttribute("data-collapsed", "true");
    expect(sidebar.querySelectorAll("a[href]").length).toBeGreaterThanOrEqual(linksBefore - 2);
    expect(screen.getAllByRole("link", { name: "Jornada Guiada" }).length).toBeGreaterThan(0);
    unmount();

    openLayout();
    expect(screen.getByRole("navigation", { name: "Menu principal" })).toHaveAttribute("data-collapsed", "true");
  });

  it("toggles with Ctrl+B", () => {
    openLayout();
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(screen.getByRole("navigation", { name: "Menu principal" })).toHaveAttribute("data-collapsed", "true");
  });
});
