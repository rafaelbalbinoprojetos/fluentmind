import { useState } from "react";
import FluentMindDashboard from "../components/dashboard/FluentMindDashboard.jsx";
import OnboardingPage, {
  FIRST_DASHBOARD_EXPERIENCE_KEY,
  ONBOARDING_COMPLETED_KEY,
  ONBOARDING_PROFILE_KEY,
} from "../components/onboarding/OnboardingPage.jsx";

function hasCompletedOnboarding() {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true";
}

export default function DashboardPage() {
  const [onboardingCompleted, setOnboardingCompleted] = useState(hasCompletedOnboarding);

  const resetOnboarding = () => {
    window.localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    window.localStorage.removeItem(ONBOARDING_PROFILE_KEY);
    window.localStorage.removeItem(FIRST_DASHBOARD_EXPERIENCE_KEY);
    setOnboardingCompleted(false);
  };

  if (!onboardingCompleted) {
    return <OnboardingPage onComplete={() => setOnboardingCompleted(true)} />;
  }

  return (
    <div className="relative">
      {import.meta.env.DEV ? (
        <button
          type="button"
          onClick={resetOnboarding}
          className="fm-ghost-button absolute right-3 top-3 z-20 rounded-full border border-[var(--border-soft)] px-3 py-1.5 text-xs font-semibold backdrop-blur"
        >
          Reset onboarding
        </button>
      ) : null}
      <FluentMindDashboard />
    </div>
  );
}
