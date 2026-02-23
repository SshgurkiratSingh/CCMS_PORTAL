"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authenticateOperator, requestPasswordReset } from "@/lib/auth/cognito";
import { extractOperatorRole } from "@/lib/auth/jwt";
import {
  getAuthSession,
  setAuthSession,
  type AuthSession,
} from "@/lib/auth/session-store";

type AuthContextValue = {
  session: AuthSession | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  forgotPassword: (username: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => getAuthSession());

  const login = useCallback(async (username: string, password: string) => {
    const tokens = await authenticateOperator(username, password);

    const nextSession: AuthSession = {
      username: username.trim(),
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      role: extractOperatorRole(tokens.accessToken),
    };

    setAuthSession(nextSession);
    setSession(nextSession);
  }, []);

  const forgotPassword = useCallback(async (username: string) => {
    await requestPasswordReset(username);
  }, []);

  const logout = useCallback(() => {
    setAuthSession(null);
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session?.accessToken),
      login,
      forgotPassword,
      logout,
    }),
    [forgotPassword, login, logout, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
