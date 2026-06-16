import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PrivacyPolicyPage from "../PrivacyPolicy.jsx";
import TermsOfUsePage from "../TermsOfUse.jsx";

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("Legal pages", () => {
  test("PrivacyPolicyPage destaca link para os Termos de Uso", () => {
    renderWithRouter(<PrivacyPolicyPage />);

    expect(
      screen.getByRole("heading", { name: /política de privacidade – korden/i }),
    ).toBeInTheDocument();
    const termsLink = screen.getByRole("link", { name: /termos de uso/i });
    expect(termsLink).toHaveAttribute("href", "/termos-de-uso");
  });

  test("TermsOfUsePage direciona para a Política de Privacidade", () => {
    renderWithRouter(<TermsOfUsePage />);

    expect(screen.getByRole("heading", { name: /termos de uso – korden/i })).toBeInTheDocument();
    const privacyLink = screen.getByRole("link", { name: /política de privacidade/i });
    expect(privacyLink).toHaveAttribute("href", "/politica-de-privacidade");
  });
});
