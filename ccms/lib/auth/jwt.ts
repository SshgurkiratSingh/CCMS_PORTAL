function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padding);

  if (typeof window === "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }

  return atob(padded);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split(".");
  if (segments.length < 2) {
    return null;
  }

  try {
    const payload = decodeBase64Url(segments[1]);
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function extractOperatorRole(
  accessToken: string
): "Admin" | "Operator" | null {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) {
    return null;
  }

  const groupsClaim = payload["cognito:groups"];
  if (Array.isArray(groupsClaim)) {
    if (groupsClaim.includes("Admin")) {
      return "Admin";
    }
    if (groupsClaim.includes("Operator")) {
      return "Operator";
    }
  }

  const roleClaim = payload["custom:role"];
  if (roleClaim === "Admin" || roleClaim === "Operator") {
    return roleClaim;
  }

  return null;
}
