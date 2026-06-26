import { useEffect, useMemo, useState } from "react";
import FluentMindDashboard from "../components/dashboard/FluentMindDashboard.jsx";
import OnboardingPage, {
  FIRST_DASHBOARD_EXPERIENCE_KEY,
  ONBOARDING_COMPLETED_KEY,
  ONBOARDING_PROFILE_KEY,
} from "../components/onboarding/OnboardingPage.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function hasCompletedOnboarding(userPreferences) {
  if (userPreferences?.extra?.onboardingCompleted === true) {
    return true;
  }
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true";
}

export default function DashboardPage() {
  const { userPreferences, updateUserPreferences } = useAuth();
  const completedFromPreferences = useMemo(() => hasCompletedOnboarding(userPreferences), [userPreferences]);
  const [onboardingCompleted, setOnboardingCompleted] = useState(completedFromPreferences);

  useEffect(() => {
    setOnboardingCompleted(completedFromPreferences);
  }, [completedFromPreferences]);

  useEffect(() => {
    if (userPreferences?.extra?.onboardingCompleted === true || typeof window === "undefined") return;
    const completed = window.localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true";
    if (!completed) return;
    let onboardingProfile = null;
    try {
      onboardingProfile = JSON.parse(window.localStorage.getItem(ONBOARDING_PROFILE_KEY) || "null");
    } catch {
      onboardingProfile = null;
    }
    updateUserPreferences?.({
      extra: {
        onboardingCompleted: true,
        onboardingProfile,
        firstDashboardExperience: window.localStorage.getItem(FIRST_DASHBOARD_EXPERIENCE_KEY) === "true",
      },
    }).catch((error) => {
      console.warn("[onboarding] Falha ao migrar onboarding para Supabase:", error.message);
    });
  }, [updateUserPreferences, userPreferences?.extra?.onboardingCompleted]);

  const resetOnboarding = () => {
    window.localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    window.localStorage.removeItem(ONBOARDING_PROFILE_KEY);
    window.localStorage.removeItem(FIRST_DASHBOARD_EXPERIENCE_KEY);
    updateUserPreferences?.({
      extra: {
        onboardingCompleted: false,
        onboardingProfile: null,
        firstDashboardExperience: false,
      },
    }).catch((error) => {
      console.warn("[onboarding] Falha ao resetar onboarding remoto:", error.message);
    });
    setOnboardingCompleted(false);
  };

  if (!onboardingCompleted) {
    return (
      <OnboardingPage
        onComplete={(profile) => {
          updateUserPreferences?.({
            extra: {
              onboardingCompleted: true,
              onboardingProfile: profile,
              firstDashboardExperience: true,
            },
          }).catch((error) => {
            console.warn("[onboarding] Falha ao salvar onboarding remoto:", error.message);
          });
          setOnboardingCompleted(true);
        }}
      />
    );
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
