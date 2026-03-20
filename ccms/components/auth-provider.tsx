"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearPendingLogin,
  completeHostedLogin,
  getHostedLogoutRedirectUrl,
  startHostedLogin,
} from "@/lib/auth/cognito";
import { extractOperatorRole, extractOperatorUsername } from "@/lib/auth/jwt";
import {
  getAuthSession,
  setAuthSession,
  type AuthSession,
} from "@/lib/auth/session-store";

type AuthContextValue = {
  session: AuthSession | null;
  isAuthenticated: boolean;
  loginWithRedirect: () => Promise<void>;
  completeLoginFromCallback: (code: string, state: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => getAuthSession());

  const loginWithRedirect = useCallback(async () => {
    await startHostedLogin();
  }, []);

  const completeLoginFromCallback = useCallback(async (code: string, state: string) => {
    const tokens = await completeHostedLogin(code, state);

    const nextSession: AuthSession = {
      username: extractOperatorUsername(tokens.idToken, tokens.accessToken),
      idToken: tokens.idToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      role: extractOperatorRole(tokens.accessToken),
    };

    setAuthSession(nextSession);
    setSession(nextSession);
  }, []);

  const logout = useCallback(async () => {
    let logoutRedirectUrl: string | null = null;
    try {
      logoutRedirectUrl = getHostedLogoutRedirectUrl();
    } catch {
      logoutRedirectUrl = null;
    }

    clearPendingLogin();
    setAuthSession(null);
    setSession(null);

    if (logoutRedirectUrl && typeof window !== "undefined") {
      window.location.assign(logoutRedirectUrl);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session?.accessToken),
      loginWithRedirect,
      completeLoginFromCallback,
      logout,
    }),
    [completeLoginFromCallback, loginWithRedirect, logout, session]
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
