import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase, supabaseConfigured } from "../lib/supabase.js";
import { isMasterEmail, sanitizeEmailInput } from "../config/accessControl.js";
import { fetchUltraAccessPassByUserId } from "../services/ultraAccess.js";
import { translateAuthErrorMessage } from "../utils/authErrors.js";
import { configureLearningEventsPersistence, hydrateLearningEvents } from "../services/learningEventEngine.js";
import { configureProgressionPersistence, hydrateProgressionState } from "../services/progressionEngine.js";
import {
  buildPreferencesFromMetadata,
  getOrCreateUserPreferences,
  updateUserPreferences as persistUserPreferences,
} from "../services/userPreferences.js";

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
  refreshUser: async () => {},
  updateUserMetadata: async () => {},
  updateUserPreferences: async () => {},
  startTrial: async () => {},
  userPreferences: null,
  subscription: {
    plan: "free",
    effectivePlan: "free",
    trialStatus: "eligible",
    trialActive: false,
    trialExpired: false,
    trialEndsAt: null,
    trialDaysLeft: 0,
    canStartTrial: true,
    hasPremiumAccess: false,
    hasLifetimeAccess: false,
    isMasterUser: false,
  },
  isMasterUser: false,
  hasLifetimeAccess: false,
  lifetimeAccessLoading: false,
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [learningStateLoading, setLearningStateLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lifetimeAccess, setLifetimeAccess] = useState(false);
  const [lifetimeLoading, setLifetimeLoading] = useState(false);
  const [ultraAccess, setUltraAccess] = useState({
    active: false,
    plan: null,
    expiresAt: null,
    isLifetime: false,
  });
  const [userPreferences, setUserPreferences] = useState(null);
  const [preferencesUserId, setPreferencesUserId] = useState(null);
  const activeAccountId = useRef(null);
  const sessionRevision = useRef(0);

  const applySession = useCallback((nextSession) => {
    const nextId = nextSession?.user?.id || null;
    if (activeAccountId.current !== nextId) {
      setLearningStateLoading(Boolean(nextId));
      setLifetimeAccess(false);
      setLifetimeLoading(false);
      setUltraAccess({ active: false, plan: null, expiresAt: null, isLifetime: false });
      setUserPreferences(null);
      setPreferencesUserId(null);
    }
    sessionRevision.current += 1;
    activeAccountId.current = nextId;
    configureProgressionPersistence(nextId);
    configureLearningEventsPersistence(nextId);
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
  }, []);

  useEffect(() => {
    let ignore = false;
    let fallbackTimer;

    async function init() {
      if (!supabaseConfigured) {
        setError(new Error("Supabase não configurado."));
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const initialRevision = sessionRevision.current;
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (ignore || initialRevision !== sessionRevision.current) return;

        if (sessionError) {
          setError(sessionError);
        } else {
          applySession(data.session);
          setError(null);
        }
      } catch (sessionError) {
        if (!ignore) {
          setError(sessionError);
        }
      } finally {
        if (!ignore) {
          if (fallbackTimer) {
            clearTimeout(fallbackTimer);
          }
          setLoading(false);
        }
      }
    }

    fallbackTimer = setTimeout(() => {
      if (!ignore) {
        setLoading(false);
        setError(new Error("Não foi possível validar a sessão. Tente novamente."));
      }
    }, 8000);

    init();

    if (!supabaseConfigured || !supabase) {
      return () => {
        ignore = true;
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
        }
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      applySession(updatedSession);
      setError(null);
    });

    return () => {
      ignore = true;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
      subscription.unsubscribe();
    };
  }, [applySession]);

  const refreshUser = useCallback(async () => {
    if (!supabaseConfigured || !supabase) {
      throw new Error("Supabase não configurado.");
    }
    const expectedUserId = activeAccountId.current;
    const { data, error: userError } = await supabase.auth.getUser();
    if (activeAccountId.current !== expectedUserId) return null;
    if (userError) {
      setError(userError);
      throw userError;
    }
    if (data.user?.id === expectedUserId) setUser(data.user);
    return data.user;
  }, []);

  const startTrial = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) throw new Error("Sessão expirada.");
    const base = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
    const response = await fetch(`${base}/api/ultra-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSession.access_token}` },
      body: JSON.stringify({ action: "start-trial" }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível iniciar o teste.");
    if (activeAccountId.current === currentSession.user.id) await refreshUser();
    return result;
  }, [refreshUser]);

  const updateUserMetadata = useCallback(
    async (patch) => {
      if (!supabaseConfigured || !supabase) {
        throw new Error("Supabase não configurado.");
      }
      const currentMetadata = user?.user_metadata ?? {};
      const newMetadata = { ...currentMetadata, ...patch };
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: newMetadata,
      });

      if (updateError) {
        setError(updateError);
        throw updateError;
      }

      if (data.user && activeAccountId.current === user?.id) {
        setUser(data.user);
      }

      return data.user;
    },
    [user],
  );

  const updateUserPreferences = useCallback(
    async (patch) => {
      const fallback = buildPreferencesFromMetadata(user?.user_metadata ?? {}, user);
      const current = preferencesUserId === user?.id ? userPreferences ?? fallback : fallback;
      const next = await persistUserPreferences(user?.id, patch, current);
      if (activeAccountId.current === user?.id) {
        setPreferencesUserId(user?.id);
        setUserPreferences(next);
      }
      return next;
    },
    [user, userPreferences, preferencesUserId],
  );

  const signIn = useCallback(
    async ({ email, password }) => {
      setError(null);
      if (!supabaseConfigured || !supabase) {
        const configError = new Error("Supabase não configurado.");
        setError(configError);
        throw configError;
      }
      const normalizedEmail = email.trim().toLowerCase();

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!signInError) {
        applySession(data.session);
        return { status: "sign-in", ...data };
      }

      const normalizedMessage = signInError.message?.toLowerCase() ?? "";
      if (!normalizedMessage.includes("invalid login credentials")) {
        const translatedError = new Error(
          translateAuthErrorMessage(signInError, "Nao foi possivel entrar. Verifique seus dados e tente novamente."),
        );
        translatedError.code = signInError.code;
        setError(translatedError);
        throw translatedError;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            plan: "free",
            has_seen_welcome: false,
            trial_status: "eligible",
            trial_started_at: null,
            trial_expires_at: null,
          },
        },
      });

      if (signUpError) {
        const alreadyRegistered = signUpError.message?.toLowerCase().includes("already registered");
        if (alreadyRegistered) {
          const existingUserError = new Error("Email já cadastrado. Verifique a senha ou redefina seu acesso.");
          existingUserError.code = "existing_user_wrong_password";
          setError(existingUserError);
          throw existingUserError;
        }

        const translatedError = new Error(
          translateAuthErrorMessage(signUpError, "Nao foi possivel criar sua conta agora. Tente novamente."),
        );
        translatedError.code = signUpError.code;
        setError(translatedError);
        throw translatedError;
      }

      applySession(signUpData.session ?? null);

      return {
        status: "sign-up",
        ...signUpData,
        requiresEmailConfirmation: !signUpData.session,
      };
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    if (!supabaseConfigured || !supabase) {
      applySession(null);
      return;
    }
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError);
      throw signOutError;
    }

    applySession(null);
  }, [applySession]);

  const normalizedEmail = useMemo(() => sanitizeEmailInput(user?.email ?? ""), [user?.email]);
  const isMasterUser = useMemo(() => Boolean(normalizedEmail) && isMasterEmail(normalizedEmail), [normalizedEmail]);

  useEffect(() => {
    let ignore = false;

    async function resolveLifetimeAccess() {
      if (!normalizedEmail) {
        if (!ignore) {
          setUltraAccess({ active: false, plan: null, expiresAt: null, isLifetime: false });
          setLifetimeAccess(false);
          setLifetimeLoading(false);
        }
        return;
      }

      if (isMasterUser) {
        if (!ignore) {
          setUltraAccess({ active: true, plan: "premium", expiresAt: null, isLifetime: true });
          setLifetimeAccess(true);
          setLifetimeLoading(false);
        }
        return;
      }

      if (!ignore) {
        setLifetimeLoading(true);
      }

      try {
        const access = await fetchUltraAccessPassByUserId(user?.id ?? null, normalizedEmail);
        if (!ignore) {
          setUltraAccess({
            active: access.active,
            plan: access.plan,
            expiresAt: access.expiresAt,
            isLifetime: access.isLifetime,
          });
          setLifetimeAccess(access.isLifetime);
        }
      } catch (ultraError) {
        if (!ignore) {
          console.warn("[auth] Falha ao checar acesso vitalício:", ultraError);
          setUltraAccess({ active: false, plan: null, expiresAt: null, isLifetime: false });
          setLifetimeAccess(false);
        }
      } finally {
        if (!ignore) {
          setLifetimeLoading(false);
        }
      }
    }

    resolveLifetimeAccess();

    return () => {
      ignore = true;
    };
  }, [normalizedEmail, isMasterUser, user]);

  useEffect(() => {
    let ignore = false;

    async function hydrateUserLearningState() {
      const userId = user?.id ?? null;
      configureProgressionPersistence(userId);
      configureLearningEventsPersistence(userId);

      if (!userId) {
        setUserPreferences(null);
        setLearningStateLoading(false);
        return;
      }

      try {
        const [, , preferences] = await Promise.all([
          hydrateProgressionState(userId),
          hydrateLearningEvents(userId),
          getOrCreateUserPreferences(user),
        ]);
        if (!ignore) {
          setPreferencesUserId(userId);
          setUserPreferences(preferences);
        }
      } catch (syncError) {
        if (!ignore) {
          console.warn("[auth] Falha ao sincronizar progresso do usuario:", syncError);
          setUserPreferences(buildPreferencesFromMetadata(user?.user_metadata ?? {}, user));
          setPreferencesUserId(userId);
        }
      } finally {
        if (!ignore && activeAccountId.current === userId) setLearningStateLoading(false);
      }
    }

    hydrateUserLearningState();

    return () => {
      ignore = true;
    };
  }, [user]);

  const metadata = useMemo(() => user?.user_metadata ?? {}, [user]);
  const accessMetadata = useMemo(() => user?.app_metadata ?? {}, [user]);

  const subscription = useMemo(() => {
    const plan = accessMetadata.plan ?? "free";
    const trialStatus = accessMetadata.trial_status ?? "eligible";
    const trialEndsAt = accessMetadata.trial_expires_at ? new Date(accessMetadata.trial_expires_at) : null;
    const trialExpired = trialEndsAt ? trialEndsAt.getTime() <= Date.now() : false;
    const normalizedUltraPlan = typeof ultraAccess.plan === "string" ? ultraAccess.plan.toLowerCase() : null;
    const ultraPremiumActive = ultraAccess.active && normalizedUltraPlan === "premium";
    const hasLifetime = lifetimeAccess || isMasterUser;
    const paidAccessActive = hasLifetime || plan === "premium" || ultraPremiumActive;
    const trialActive = !paidAccessActive && trialStatus === "active"
      && trialEndsAt?.getTime() > Date.now();
    const effectivePlan = hasLifetime ? "ultra" : (ultraAccess.active ? ultraAccess.plan ?? plan : plan);
    const hasPremiumAccess = hasLifetime || plan === "premium" || trialActive || ultraPremiumActive;
    const canStartTrial = !hasPremiumAccess && (!trialStatus || trialStatus === "eligible");
    const trialDaysLeft =
      trialActive && trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000)) : 0;

    return {
      plan,
      effectivePlan,
      trialStatus,
      trialEndsAt,
      trialExpired,
      trialActive,
      trialDaysLeft,
      canStartTrial,
      hasPremiumAccess,
      hasLifetimeAccess: hasLifetime,
      isMasterUser,
    };
  }, [accessMetadata, lifetimeAccess, isMasterUser, ultraAccess]);

  const effectiveUserPreferences = useMemo(
    () => (preferencesUserId === user?.id ? userPreferences : null) ?? buildPreferencesFromMetadata(metadata, user),
    [metadata, user, userPreferences, preferencesUserId],
  );

  const value = useMemo(
    () => ({
      user,
      session,
      loading: loading || learningStateLoading,
      error,
      signIn,
      signOut,
      refreshUser,
      updateUserMetadata,
      updateUserPreferences,
      startTrial,
      userPreferences: effectiveUserPreferences,
      subscription,
      isMasterUser: subscription.isMasterUser,
      hasLifetimeAccess: subscription.hasLifetimeAccess,
      lifetimeAccessLoading: lifetimeLoading,
    }),
    [
      error,
      loading,
      learningStateLoading,
      refreshUser,
      session,
      signIn,
      signOut,
      subscription,
      updateUserMetadata,
      updateUserPreferences,
      startTrial,
      effectiveUserPreferences,
      user,
      lifetimeLoading,
    ],
  );

  return <AuthContext.Provider value={value}><React.Fragment key={user?.id || "guest"}>{children}</React.Fragment></AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
