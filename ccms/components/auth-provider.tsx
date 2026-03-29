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
      logout,
    }),
    [login, logout, session],
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
