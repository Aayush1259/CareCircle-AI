import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import toast from "react-hot-toast";
import type { AuthSession, BootstrapPayload } from "@carecircle/shared";
import { apiRequest, authStorageKey } from "@/lib/api";

interface AppDataContextValue {
  session: AuthSession | null;
  bootstrap: BootstrapPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  request: typeof apiRequest;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

export const AppDataProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestBootstrapRef = useRef<BootstrapPayload | null>(null);

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

  const loadAppState = useCallback(async ({ silent = false, announce = false }: { silent?: boolean; announce?: boolean } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const token = window.localStorage.getItem(authStorageKey);
      if (!token) {
        setSession(null);
        setBootstrap(null);
        setError(null);
        latestBootstrapRef.current = null;
        return;
      }

      const sessionPayload = await apiRequest<{ session: AuthSession }>("/auth/session");
      window.localStorage.setItem(authStorageKey, sessionPayload.session.token);
      setSession(sessionPayload.session);
      const payload = await apiRequest<BootstrapPayload>("/bootstrap");
      if (announce) {
        announceIncomingChanges(latestBootstrapRef.current, payload);
      }
      latestBootstrapRef.current = payload;
      setBootstrap(payload);
      setError(null);
    } catch (nextError) {
      window.localStorage.removeItem(authStorageKey);
      setSession(null);
      setBootstrap(null);
      latestBootstrapRef.current = null;
      setError(nextError instanceof Error ? nextError.message : "Unable to load CareCircle right now.");
    } finally {
      setLoading(false);
    }
  }, [announceIncomingChanges]);

  const refresh = useCallback(async () => {
    await loadAppState();
  }, [loadAppState]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const payload = await apiRequest<{ session: AuthSession }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      window.localStorage.setItem(authStorageKey, payload.session.token);
      setSession(payload.session);
      const bootstrapPayload = await apiRequest<BootstrapPayload>("/bootstrap");
      setBootstrap(bootstrapPayload);
      setError(null);
    } catch (nextError) {
      window.localStorage.removeItem(authStorageKey);
      setSession(null);
      setBootstrap(null);
      setError(nextError instanceof Error ? nextError.message : "We could not sign you in right now.");
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch {
      // Ignore logout network errors and clear the local session anyway.
    } finally {
      window.localStorage.removeItem(authStorageKey);
      setSession(null);
      setBootstrap(null);
      setError(null);
    }
  }, []);

  useEffect(() => {
    void loadAppState();
  }, [loadAppState]);

  useEffect(() => {
    if (!session) return undefined;
    const interval = window.setInterval(() => {
      void loadAppState({ silent: true, announce: true });
    }, 30000);
    return () => window.clearInterval(interval);
  }, [session, loadAppState]);

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
      loading,
      error,
      refresh,
      request: apiRequest,
      login,
      logout,
    }),
    [session, bootstrap, loading, error, refresh, login, logout],
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
