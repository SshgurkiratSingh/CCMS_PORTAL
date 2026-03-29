export type AuthSession = {
  dashboardKey: string;
  adminKey?: string;
  role: "Admin" | "Operator" | "Viewer" | null;
};

let activeSession: AuthSession | null = null;
const SESSION_KEY = "ccms_dashboard_session";

export function getAuthSession(): AuthSession | null {
  if (activeSession) return activeSession;

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        activeSession = JSON.parse(stored);
        return activeSession;
      }
    } catch (e) {
      console.error("Failed to parse session from localStorage", e);
    }
  }

  return null;
}

export function setAuthSession(session: AuthSession | null): void {
  activeSession = session;

  if (typeof window !== "undefined") {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }
}

export function getDashboardKey(): string | null {
  return getAuthSession()?.dashboardKey ?? null;
}

export function getAdminKey(): string | null {
  return getAuthSession()?.adminKey ?? null;
}
