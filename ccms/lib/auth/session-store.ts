export type AuthSession = {
  username: string;
  idToken: string;
  accessToken: string;
  refreshToken: string;
  role: "Admin" | "Operator" | null;
};

let activeSession: AuthSession | null = null;

export function getAuthSession(): AuthSession | null {
  return activeSession;
}

export function setAuthSession(session: AuthSession | null): void {
  activeSession = session;
}

export function getAccessToken(): string | null {
  return activeSession?.accessToken ?? null;
}
