import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigured } from "../lib/supabase.js";
import { isMasterEmail, sanitizeEmailInput } from "../config/accessControl.js";
import { fetchUltraAccessPassByUserId } from "../services/ultraAccess.js";
import { translateAuthErrorMessage } from "../utils/authErrors.js";

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
  refreshUser: async () => {},
  updateUserMetadata: async () => {},
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
  const [error, setError] = useState(null);
  const [lifetimeAccess, setLifetimeAccess] = useState(false);
  const [lifetimeLoading, setLifetimeLoading] = useState(false);
  const [ultraAccess, setUltraAccess] = useState({
    active: false,
    plan: null,
    expiresAt: null,
    isLifetime: false,
  });

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
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (ignore) return;

        if (sessionError) {
          setError(sessionError);
        } else {
          setSession(data.session);
          setUser(data.session?.user ?? null);
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
      setSession(updatedSession);
      setUser(updatedSession?.user ?? null);
      setError(null);
    });

    return () => {
      ignore = true;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
      subscription.unsubscribe();
    };
  }, []);

  const refreshUser = useCallback(async () => {
    if (!supabaseConfigured || !supabase) {
      throw new Error("Supabase não configurado.");
    }
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) {
      setError(userError);
      throw userError;
    }
    setUser(data.user);
    return data.user;
  }, []);

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

      if (data.user) {
        setUser(data.user);
      }

      return data.user;
    },
    [user],
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
        setSession(data.session);
        setUser(data.user);
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

      setSession(signUpData.session ?? null);
      setUser(signUpData.user ?? signUpData.session?.user ?? null);

      return {
        status: "sign-up",
        ...signUpData,
        requiresEmailConfirmation: !signUpData.session,
      };
    },
    [],
  );

  const signOut = useCallback(async () => {
    if (!supabaseConfigured || !supabase) {
      setSession(null);
      setUser(null);
      return;
    }
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError);
      throw signOutError;
    }

    setSession(null);
    setUser(null);
  }, []);

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
  }, [normalizedEmail, isMasterUser]);

  const metadata = useMemo(() => user?.user_metadata ?? {}, [user]);

  const subscription = useMemo(() => {
    const plan = metadata.plan ?? "free";
    const trialStatus = metadata.trial_status ?? "eligible";
    const trialEndsAt = metadata.trial_expires_at ? new Date(metadata.trial_expires_at) : null;
    const trialExpired = trialEndsAt ? trialEndsAt.getTime() <= Date.now() : false;
    const normalizedUltraPlan = typeof ultraAccess.plan === "string" ? ultraAccess.plan.toLowerCase() : null;
    const ultraPremiumActive = ultraAccess.active && normalizedUltraPlan === "premium";
    const hasLifetime = lifetimeAccess || isMasterUser;
    const paidAccessActive = hasLifetime || plan === "premium" || ultraPremiumActive;
    const trialActive = !paidAccessActive && trialStatus === "active" && !trialExpired;
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
  }, [metadata, lifetimeAccess, isMasterUser, ultraAccess]);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      error,
      signIn,
      signOut,
      refreshUser,
      updateUserMetadata,
      subscription,
      isMasterUser: subscription.isMasterUser,
      hasLifetimeAccess: subscription.hasLifetimeAccess,
      lifetimeAccessLoading: lifetimeLoading,
    }),
    [
      error,
      loading,
      refreshUser,
      session,
      signIn,
      signOut,
      subscription,
      updateUserMetadata,
      user,
      lifetimeLoading,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
