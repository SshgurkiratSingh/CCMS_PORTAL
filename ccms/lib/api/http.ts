import { getAccessToken } from "@/lib/auth/session-store";

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

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (requireAuth) {
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error("Missing access token. Login is required.");
    }

    headers.Authorization = `Bearer ${accessToken}`;
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
