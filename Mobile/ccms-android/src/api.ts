import type { Panel, RawSnapshotItem, RawTelemetry } from "./types";

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

function endpoint(path: string): string {
  if (!baseUrl) {
    throw new Error("Missing EXPO_PUBLIC_API_BASE_URL. Copy .env.example to .env first.");
  }
  return new URL(path, baseUrl).toString();
}

async function request<T>(path: string, dashboardKey: string): Promise<T> {
  const response = await fetch(endpoint(path), {
    headers: {
      Accept: "application/json",
      "x-dashboard-key": dashboardKey,
    },
  });
  const body = await response.text();
  const data = body ? JSON.parse(body) : null;

  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data
      ? String(data.error)
      : `API request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function getSnapshot(dashboardKey: string): Promise<RawSnapshotItem[]> {
  return request<RawSnapshotItem[]>("DashboardAPIHandler?enquiry=snapshot", dashboardKey);
}

export function toPanels(snapshot: RawSnapshotItem[]): Panel[] {
  return snapshot.map((item) => {
    const metadata = item.metadata ?? {};
    const location = (metadata.location ?? {}) as Record<string, unknown>;
    const id = String(metadata.panel_id ?? "Unknown");
    return {
      id,
      name: String(location.locationPlace ?? id),
      status: String(metadata.status ?? "UNKNOWN").toUpperCase(),
      deviceId: String(metadata.device_id ?? item.recent_logs?.[0]?.client_id ?? "Not provisioned"),
      latest: item.recent_logs?.[0],
    };
  });
}

export function numberValue(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function telemetryDate(value: unknown): Date | undefined {
  const timestamp = numberValue(value);
  if (!timestamp) return undefined;
  // Firmware v3 currently emits epoch seconds; stored Lambda readings are milliseconds.
  return new Date(timestamp < 100_000_000_000 ? timestamp * 1000 : timestamp);
}

export function latestValue(telemetry: RawTelemetry | undefined, key: string): number {
  return numberValue(telemetry?.[key]);
}
