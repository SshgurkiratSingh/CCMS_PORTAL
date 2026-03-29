import { getDashboardKey, getAdminKey } from "@/lib/auth/session-store";

type RequestConfig = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  requireAuth?: boolean;
};

function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("Missing NEXT_PUBLIC_API_BASE_URL.");
  }

  return baseUrl;
}

export async function apiRequest<T>(
  path: string,
  config: RequestConfig = {}
): Promise<T> {
  const { method = "GET", body, requireAuth = true } = config;

  const headers = new Headers();
  headers.append("Content-Type", "application/json");

  if (requireAuth) {
    const dashboardKey = getDashboardKey();
    if (!dashboardKey) {
      throw new Error("Missing dashboard key. Login is required.");
    }

    headers.append("x-dashboard-key", dashboardKey);

    const adminKey = getAdminKey();
    if (adminKey) {
      headers.append("x-admin-key", adminKey);
    }
  }

  const url = new URL(path, getApiBaseUrl()).toString();

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const message =
      (parsed && typeof parsed === "object" && "message" in parsed
        ? String(parsed.message)
        : null) ?? `API request failed (${response.status})`;
    throw new Error(message);
  }

  return parsed as T;
}
