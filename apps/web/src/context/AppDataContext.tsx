import { createContext, startTransition, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import toast from "react-hot-toast";
import type { AuthSession, BootstrapPayload } from "@carecircle/shared";
import { activePatientStorageKey, apiRequest, authStorageKey } from "@/lib/api";
import { browserSupabase, googleAuthContextStorageKey, type GoogleAuthContext } from "@/lib/supabaseBrowser";

type AppRuntimeConfig = BootstrapPayload["appConfig"];

interface AppDataContextValue {
  session: AuthSession | null;
  bootstrap: BootstrapPayload | null;
  appConfig: AppRuntimeConfig;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  request: typeof apiRequest;
  login: (email: string, password: string) => Promise<AuthSession>;
  signup: (input: {
    name: string;
    email: string;
    password: string;
    role: "caregiver" | "family_member" | "doctor" | "primary_caregiver" | "secondary_caregiver";
    licenseNumber?: string;
  }) => Promise<AuthSession>;
  startGoogleAuth: (context: GoogleAuthContext) => Promise<void>;
  completeGoogleAuth: () => Promise<{ session: AuthSession; inviteToken?: string }>;
  requestPasswordReset: (email: string) => Promise<{ message: string }>;
  confirmPasswordReset: (token: string, password: string) => Promise<{ message: string }>;
  logout: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

const hasStoredAuthToken = () => {
  if (typeof window === "undefined") return true;
  return Boolean(window.localStorage.getItem(authStorageKey));
};

export const AppDataProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [appConfig, setAppConfig] = useState<AppRuntimeConfig>({ googleAuthEnabled: false });
  const [loading, setLoading] = useState(() => hasStoredAuthToken());
  const [error, setError] = useState<string | null>(null);
  const latestBootstrapRef = useRef<BootstrapPayload | null>(null);

  const loadPublicConfig = useCallback(async () => {
    try {
      const config = await apiRequest<AppRuntimeConfig>("/config");
      setAppConfig(config);
      return config;
    } catch {
      const fallback = { googleAuthEnabled: false };
      setAppConfig(fallback);
      return fallback;
    }
  }, []);

  const announceIncomingChanges = useCallback((previous: BootstrapPayload | null, next: BootstrapPayload) => {
    if (!previous) return;

    const previousUnread = previous.data.notifications.filter((item) => !item.isRead).length;
    const nextUnread = next.data.notifications.filter((item) => !item.isRead).length;
    if (nextUnread > previousUnread) {
      toast(`You have ${nextUnread - previousUnread} new update${nextUnread - previousUnread === 1 ? "" : "s"}.`, {
        icon: "🔔",
      });
    }

    const previousActivityId = previous.data.activityEvents[0]?.id;
    const nextActivity = next.data.activityEvents[0];
    if (nextActivity && nextActivity.id !== previousActivityId) {
      const label = `${nextActivity.actorName} ${nextActivity.description}`;
      if (nextActivity.type === "medication_logged") {
        toast(label, { icon: "💊" });
      } else if (nextActivity.type === "message_sent") {
        toast(label, { icon: "💬" });
      }
    }
  }, []);

  const clearAuthState = useCallback(() => {
    window.localStorage.removeItem(authStorageKey);
    startTransition(() => {
      setSession(null);
      setBootstrap(null);
      setError(null);
    });
    latestBootstrapRef.current = null;
    window.sessionStorage.removeItem(activePatientStorageKey);
  }, []);

  const applyBootstrapPayload = useCallback((payload: BootstrapPayload, { announce = false }: { announce?: boolean } = {}) => {
    if (announce) {
      announceIncomingChanges(latestBootstrapRef.current, payload);
    }
    latestBootstrapRef.current = payload;
    window.sessionStorage.setItem(activePatientStorageKey, payload.patient.id);
    startTransition(() => {
      setBootstrap(payload);
      setAppConfig(payload.appConfig);
      setError(null);
    });
  }, [announceIncomingChanges]);

  const loadAppState = useCallback(async ({ silent = false, announce = false }: { silent?: boolean; announce?: boolean } = {}) => {
    const token = window.localStorage.getItem(authStorageKey);
    if (!token) {
      void loadPublicConfig();
      clearAuthState();
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
    }

    const configPromise = loadPublicConfig();
    try {
      const sessionPayload = await apiRequest<{ session: AuthSession }>("/auth/session");
      window.localStorage.setItem(authStorageKey, sessionPayload.session.token);
      startTransition(() => {
        setSession(sessionPayload.session);
      });
      const payload = await apiRequest<BootstrapPayload>("/bootstrap");
      applyBootstrapPayload(payload, { announce });
      await configPromise;
    } catch (nextError) {
      clearAuthState();
      startTransition(() => {
        setError(nextError instanceof Error ? nextError.message : "Unable to load CareCircle right now.");
      });
    } finally {
      setLoading(false);
    }
  }, [applyBootstrapPayload, clearAuthState, loadPublicConfig]);

  const refreshBootstrap = useCallback(async ({ announce = false, recover = false }: { announce?: boolean; recover?: boolean } = {}) => {
    const token = window.localStorage.getItem(authStorageKey);
    if (!token) {
      if (recover) {
        await loadAppState({ silent: true, announce });
        return;
      }
      throw new Error("Please sign in again.");
    }

    try {
      const payload = await apiRequest<BootstrapPayload>("/bootstrap");
      applyBootstrapPayload(payload, { announce });
    } catch (nextError) {
      if (recover) {
        await loadAppState({ silent: true, announce });
        return;
      }
      throw nextError;
    }
  }, [applyBootstrapPayload, loadAppState]);

  const refresh = useCallback(async () => {
    await refreshBootstrap();
  }, [refreshBootstrap]);

  const finalizeAuthenticatedSession = useCallback(async (nextSession: AuthSession) => {
    window.localStorage.setItem(authStorageKey, nextSession.token);
    startTransition(() => {
      setSession(nextSession);
    });
    const bootstrapPayload = await apiRequest<BootstrapPayload>("/bootstrap");
    applyBootstrapPayload(bootstrapPayload);
  }, [applyBootstrapPayload]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const payload = await apiRequest<{ session: AuthSession }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await finalizeAuthenticatedSession(payload.session);
      return payload.session;
    } catch (nextError) {
      clearAuthState();
      startTransition(() => {
        setError(nextError instanceof Error ? nextError.message : "We could not sign you in right now.");
      });
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, [clearAuthState, finalizeAuthenticatedSession]);

  const signup = useCallback(async (input: {
    name: string;
    email: string;
    password: string;
    role: "caregiver" | "family_member" | "doctor" | "primary_caregiver" | "secondary_caregiver";
    licenseNumber?: string;
  }) => {
    setLoading(true);
    try {
      const payload = await apiRequest<{ session: AuthSession }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await finalizeAuthenticatedSession(payload.session);
      return payload.session;
    } catch (nextError) {
      clearAuthState();
      startTransition(() => {
        setError(nextError instanceof Error ? nextError.message : "We could not create your account right now.");
      });
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, [clearAuthState, finalizeAuthenticatedSession]);

  const startGoogleAuth = useCallback(async (context: GoogleAuthContext) => {
    if (!appConfig.googleAuthEnabled) {
      throw new Error("Google sign-in is hidden until the Google provider is fully configured in Supabase.");
    }
    if (!browserSupabase) {
      throw new Error("Google sign-in is not available until Supabase browser auth is configured.");
    }

    window.sessionStorage.setItem(googleAuthContextStorageKey, JSON.stringify(context));
    const redirectUrl = new URL("/auth/callback", window.location.origin);
    if (context.inviteToken) {
      redirectUrl.searchParams.set("inviteToken", context.inviteToken);
    }

    const { error: authError } = await browserSupabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl.toString(),
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (authError) {
      window.sessionStorage.removeItem(googleAuthContextStorageKey);
      throw new Error(authError.message);
    }
  }, [appConfig.googleAuthEnabled]);

  const completeGoogleAuth = useCallback(async () => {
    if (!browserSupabase) {
      throw new Error("Google sign-in is not available until Supabase browser auth is configured.");
    }

    setLoading(true);
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      const providerError = searchParams.get("error_description") || searchParams.get("error");
      if (providerError) {
        const decodedError = decodeURIComponent(providerError);
        if (decodedError.toLowerCase().includes("missing oauth secret")) {
          throw new Error("Google sign-in is not fully configured in Supabase yet. Add the Google OAuth client secret and callback URL first.");
        }
        throw new Error(decodedError);
      }

      const storedContext = window.sessionStorage.getItem(googleAuthContextStorageKey);
      const authContext = storedContext ? (JSON.parse(storedContext) as GoogleAuthContext) : undefined;

      if (code) {
        const { error: exchangeError } = await browserSupabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          throw new Error(exchangeError.message);
        }
      }

      const { data, error: sessionError } = await browserSupabase.auth.getSession();
      if (sessionError) {
        throw new Error(sessionError.message);
      }
      if (!data.session?.access_token) {
        throw new Error("Google sign-in finished without a usable Supabase session.");
      }

      const payload = await apiRequest<{ session: AuthSession }>("/auth/oauth/exchange", {
        method: "POST",
        body: JSON.stringify({
          accessToken: data.session.access_token,
          role: authContext?.role,
          licenseNumber: authContext?.licenseNumber,
          name: authContext?.name,
        }),
      });

      await finalizeAuthenticatedSession(payload.session);
      window.sessionStorage.removeItem(googleAuthContextStorageKey);
      return { session: payload.session, inviteToken: authContext?.inviteToken };
    } catch (nextError) {
      clearAuthState();
      startTransition(() => {
        setError(nextError instanceof Error ? nextError.message : "Google sign-in could not be completed.");
      });
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, [clearAuthState, finalizeAuthenticatedSession]);

  const requestPasswordReset = useCallback(async (email: string) => {
    return apiRequest<{ message: string }>("/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }, []);

  const confirmPasswordReset = useCallback(async (token: string, password: string) => {
    return apiRequest<{ message: string }>("/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  }, []);

  const logout = useCallback(async () => {
    if (browserSupabase) {
      void browserSupabase.auth.signOut();
    }
    window.sessionStorage.removeItem(googleAuthContextStorageKey);
    window.sessionStorage.removeItem(activePatientStorageKey);
    window.localStorage.removeItem(authStorageKey);
    startTransition(() => {
      setSession(null);
      setBootstrap(null);
      setError(null);
    });
    latestBootstrapRef.current = null;
  }, []);

  useEffect(() => {
    void loadAppState();
  }, [loadAppState]);

  useEffect(() => {
    if (!session) return undefined;
    const interval = window.setInterval(() => {
      void refreshBootstrap({ announce: true, recover: true });
    }, 30000);
    return () => window.clearInterval(interval);
  }, [refreshBootstrap, session]);

  useEffect(() => {
    const settings = bootstrap?.data.settings.find((item) => item.userId === bootstrap.viewer.id);
    if (!settings) return;
    document.documentElement.dataset.theme = settings.display.colorTheme;
    document.documentElement.dataset.fontScale = settings.display.fontSize;
    document.documentElement.dataset.contrast = settings.display.highContrast ? "high" : "normal";
  }, [bootstrap]);

  const value = useMemo(
    () => ({
      session,
      bootstrap,
      appConfig,
      loading,
      error,
      refresh,
      request: apiRequest,
      login,
      signup,
      startGoogleAuth,
      completeGoogleAuth,
      requestPasswordReset,
      confirmPasswordReset,
      logout,
    }),
    [
      session,
      bootstrap,
      appConfig,
      loading,
      error,
      refresh,
      login,
      signup,
      startGoogleAuth,
      completeGoogleAuth,
      requestPasswordReset,
      confirmPasswordReset,
      logout,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider.");
  }
  return context;
};
