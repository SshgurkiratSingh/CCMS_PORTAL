import { apiRequest } from "@/lib/api/http";
import type {
  AlertListResponse,
  AlertRecord,
  AlertSeverity,
  DashboardSummary,
  PanelCommandPayload,
  PanelCommandResult,
  PanelListResponse,
  PanelLiveStatus,
  PanelState,
  TelemetryResponse,
} from "@/lib/api/types";

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>("/api/v1/dashboard/summary");
}

export async function getPanels(params: {
  status?: PanelState;
  limit?: number;
  offset?: number;
}): Promise<PanelListResponse> {
  const query = new URLSearchParams();

  if (params.status) {
    query.set("status", params.status);
  }
  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }
  if (typeof params.offset === "number") {
    query.set("offset", String(params.offset));
  }

  const queryString = query.toString();
  const path = queryString
    ? `/api/v1/panels?${queryString}`
    : "/api/v1/panels";

  return apiRequest<PanelListResponse>(path);
}

export async function getPanelStatus(panelId: string): Promise<PanelLiveStatus> {
  return apiRequest<PanelLiveStatus>(`/api/v1/panels/${panelId}/status`);
}

export async function postPanelCommand(
  panelId: string,
  payload: PanelCommandPayload
): Promise<PanelCommandResult> {
  return apiRequest<PanelCommandResult>(`/api/v1/panels/${panelId}/command`, {
    method: "POST",
    body: payload,
  });
}

export async function getPanelTelemetry(input: {
  panelId: string;
  startUtcIso: string;
  endUtcIso: string;
}): Promise<TelemetryResponse> {
  const query = new URLSearchParams({
    start: input.startUtcIso,
    end: input.endUtcIso,
  });

  return apiRequest<TelemetryResponse>(
    `/api/v1/panels/${input.panelId}/telemetry?${query.toString()}`
  );
}

export async function getAlerts(
  severity?: AlertSeverity
): Promise<AlertListResponse> {
  const query = new URLSearchParams();
  if (severity) {
    query.set("severity", severity);
  }

  const queryString = query.toString();
  const path = queryString
    ? `/api/v1/alerts?${queryString}`
    : "/api/v1/alerts";

  return apiRequest<AlertListResponse>(path);
}

export async function acknowledgeAlert(
  alertId: string,
  operatorId: string
): Promise<AlertRecord> {
  return apiRequest<AlertRecord>(`/api/v1/alerts/${alertId}`, {
    method: "PATCH",
    body: {
      status: "ACKNOWLEDGED",
      operatorId,
    },
  });
}
