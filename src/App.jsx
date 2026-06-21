import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./layout/Layout.jsx";
import DashboardPage from "./pages/Dashboard.jsx";
import LibraryPage from "./pages/Library.jsx";
import InsightsPage from "./pages/Insights.jsx";
import ChatbotPage from "./pages/Chatbot.jsx";
import NeuralUniversePage from "./pages/NeuralUniverse.jsx";
import SettingsPage from "./pages/Settings.jsx";
import LoginPage from "./pages/auth/Login.jsx";
import PasswordRecoveryPage from "./pages/auth/PasswordRecovery.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import PrivacyPolicyPage from "./pages/PrivacyPolicy.jsx";
import TermsOfUsePage from "./pages/TermsOfUse.jsx";
import LandingPage from "./pages/Landing.jsx";
import UltraAccessConfirmPage from "./pages/UltraAccessConfirm.jsx";
import UsersManagementPage from "./pages/UsersManagement.jsx";

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
            <Route path="biblioteca" element={<LibraryPage />} />
            <Route path="insights" element={<InsightsPage />} />
            <Route path="chatbot" element={<ChatbotPage />} />
            <Route path="neural-universe" element={<NeuralUniversePage />} />
            <Route path="acesso-ultra/confirmar" element={<UltraAccessConfirmPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
            <Route path="usuarios" element={<UsersManagementPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
