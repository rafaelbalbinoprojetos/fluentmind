import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./layout/Layout.jsx";
import DashboardPage from "./pages/Dashboard.jsx";
import ExpensesPage from "./pages/Expenses.jsx";
import IncomePage from "./pages/Income.jsx";
import InvestmentsPage from "./pages/Investments.jsx";
import ExtraPage from "./pages/Extra.jsx";
import LibraryPage from "./pages/Library.jsx";
import InsightsPage from "./pages/Insights.jsx";
import ChatbotPage from "./pages/Chatbot.jsx";
import CardsPage from "./pages/Cards.jsx";
import MarketRadarPage from "./pages/MarketRadar.jsx";
import RadarAssetDetailsPage from "./pages/RadarAssetDetails.jsx";
import NeuralUniversePage from "./pages/NeuralUniverse.jsx";
import SettingsPage from "./pages/Settings.jsx";
import GestorPage from "./pages/Gestor.jsx";
import CompoundInterestPage from "./pages/CompoundInterest.jsx";
import FixedBillsPage from "./pages/FixedBills.jsx";
import LoginPage from "./pages/auth/Login.jsx";
import PasswordRecoveryPage from "./pages/auth/PasswordRecovery.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ExpenseCreatePage from "./pages/ExpenseCreate.jsx";
import RevenueCreatePage from "./pages/RevenueCreate.jsx";
import InvestmentCreatePage from "./pages/InvestmentCreate.jsx";
import OvertimeCreatePage from "./pages/OvertimeCreate.jsx";
import PrivacyPolicyPage from "./pages/PrivacyPolicy.jsx";
import TermsOfUsePage from "./pages/TermsOfUse.jsx";
import LandingPage from "./pages/Landing.jsx";
import UltraAccessConfirmPage from "./pages/UltraAccessConfirm.jsx";
import UsersManagementPage from "./pages/UsersManagement.jsx";
import BankConnectionsPage from "./pages/BankConnections.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<LoginPage />} />
        <Route path="/landing" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Navigate to="/app" replace />} />
        <Route path="/recuperar-senha" element={<PasswordRecoveryPage />} />
        <Route path="/politica-de-privacidade" element={<PrivacyPolicyPage />} />
        <Route path="/termos-de-uso" element={<TermsOfUsePage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="despesas" element={<ExpensesPage />} />
            <Route path="despesas/nova" element={<ExpenseCreatePage />} />
            <Route path="rendas" element={<IncomePage />} />
            <Route path="rendas/nova" element={<RevenueCreatePage />} />
            <Route path="receitas" element={<Navigate to="/rendas" replace />} />
            <Route path="contas-fixas" element={<FixedBillsPage />} />
            <Route path="investir" element={<InvestmentsPage />} />
            <Route path="investir/novo" element={<InvestmentCreatePage />} />
            <Route path="juros-compostos" element={<CompoundInterestPage />} />
            <Route path="extra" element={<ExtraPage />} />
            <Route path="extra/novo" element={<OvertimeCreatePage />} />
            <Route path="gestor" element={<GestorPage />} />
            <Route path="biblioteca" element={<LibraryPage />} />
            <Route path="insights" element={<InsightsPage />} />
            <Route path="chatbot" element={<ChatbotPage />} />
            <Route path="radar" element={<MarketRadarPage />} />
            <Route path="radar/ativo/:symbol" element={<RadarAssetDetailsPage />} />
            <Route path="neural-universe" element={<NeuralUniversePage />} />
            <Route path="cartoes" element={<CardsPage />} />
            <Route path="acesso-ultra/confirmar" element={<UltraAccessConfirmPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
            <Route path="usuarios" element={<UsersManagementPage />} />
            <Route path="contas-bancarias" element={<BankConnectionsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
