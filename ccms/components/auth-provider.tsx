"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getAuthSession,
  setAuthSession,
  type AuthSession,
} from "@/lib/auth/session-store";

type AuthContextValue = {
  session: AuthSession | null;
  isAuthenticated: boolean;
  login: (dashboardKey: string, adminKey?: string) => Promise<void>;
  setAdminKey: (adminKey: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setSession(getAuthSession());
    setIsMounted(true);
  }, []);

  const login = useCallback(async (dashboardKey: string, adminKey?: string) => {
    const nextSession: AuthSession = {
      dashboardKey,
      adminKey,
      role: adminKey ? "Admin" : "Operator",
    };

    setAuthSession(nextSession);
    setSession(nextSession);
  }, []);

  const setAdminKey = useCallback(
    async (adminKey: string) => {
      const trimmedAdminKey = adminKey.trim();
      if (!trimmedAdminKey) {
        throw new Error("Admin key is required.");
      }

      const persistedSession = getAuthSession();
      const currentSession = persistedSession ?? session;
      const dashboardKey = currentSession?.dashboardKey?.trim();

      if (!dashboardKey) {
        throw new Error("Missing dashboard key. Login is required.");
      }

      const nextSession: AuthSession = {
        ...currentSession,
        dashboardKey,
        adminKey: trimmedAdminKey,
        role: "Admin",
      };

      setAuthSession(nextSession);
      setSession(nextSession);
    },
    [session],
  );

  const logout = useCallback(() => {
    setAuthSession(null);
    setSession(null);

    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session?.dashboardKey),
      login,
      setAdminKey,
      logout,
    }),
    [login, logout, session, setAdminKey],
  );

  // Return empty provider on server to avoid hydration mismatch, since session relies on localStorage
  if (!isMounted)
    return <AuthContext.Provider value={value}>{null}</AuthContext.Provider>;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
