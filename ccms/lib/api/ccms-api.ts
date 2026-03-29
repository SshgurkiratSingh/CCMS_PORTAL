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

// Lambda raw response types
type SnapshotItem = {
  metadata: any;
  recent_logs: any[];
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const snapshot = await apiRequest<SnapshotItem[]>("DashboardAPIHandler?enquiry=snapshot");
  
  let activeAlarms = 0;
  
  // Grid parameters extracted from the first responding panel for the dashboard snapshot
  let gridAvgVoltage: number | undefined = undefined;
  let gridFrequency: number | undefined = undefined;
  let gridTotalPf: number | undefined = undefined;
  
  // Calculate instantaneous fleet power load in kW
  let currentFleetPowerKw = 0;

  for (const item of snapshot) {
    if (item.metadata?.status === "FAULT") {
      activeAlarms++;
    }

    if (item.recent_logs?.length > 0) {
      const latest = item.recent_logs[0];
      
      // Try to capture top-level grid metrics if not set
      if (typeof gridAvgVoltage === "undefined") {
        gridAvgVoltage = latest.R3035;        // Avg Volt
        gridFrequency = latest.R3109;         // Freq
        gridTotalPf = latest.R3053;           // System PF
      }
      
      // Add up Power = (V * I * PF) / 1000
      const v = latest.R3035 || 0;
      const i = latest.R3009 || 0;
      const pf = latest.R3053 || 0;
      if (v > 0 && i > 0 && pf > 0) {
        currentFleetPowerKw += (v * i * pf) / 1000;
      }
    }
  }

  // To simulate a rough 24h KWH consumption, we extrapolate the current load across 12 hours (night load)
  // Real implementions would query an aggregations table in DynamoDB.
  const estEnergyLast24hKwh = Math.round(currentFleetPowerKw * 12);

  return {
    totalPanels: snapshot.length,
    activeAlarms,
    energyLast24hKwh: estEnergyLast24hKwh, 
    gridAvgVoltage,
    gridFrequency,
    gridTotalPf,
    generatedAtUtc: new Date().toISOString(),
  };
}

export async function getPanels(params: {
  status?: PanelState;
  limit?: number;
  offset?: number;
}): Promise<PanelListResponse> {
  const snapshot = await apiRequest<SnapshotItem[]>("DashboardAPIHandler?enquiry=snapshot");

  let items = snapshot.map((item) => {
    const meta = item.metadata;
    let status: PanelState = "UNKNOWN";
    if (meta.status === "active" || meta.status === "ONLINE") status = "ONLINE";
    if (meta.status === "FAULT") status = "FAULT";
    if (meta.status === "OFFLINE") status = "OFFLINE";

    return {
      panelId: meta.panel_id || "Unknown",
      name: meta.location?.locationPlace || meta.panel_id || "Unknown node",
      status,
      gpsLat: meta.location?.coordinates?.lat || 0,
      gpsLng: meta.location?.coordinates?.lng || 0,
      macAddress: meta.mac_address || "00:00:00:00:00:00",
      firmwareVersion: meta.firmware || "1.0.0",
      lastSeenUtc: meta.last_seen || new Date().toISOString(),
    };
  });

  if (params.status && params.status !== "ALL" as any) {
    items = items.filter((p) => p.status === params.status);
  }

  const offset = params.offset || 0;
  const limit = params.limit || 50;
  const paginated = items.slice(offset, offset + limit);

  return {
    items: paginated,
    total: items.length,
    limit,
    offset,
  };
}

export async function getPanelStatus(panelId: string): Promise<PanelLiveStatus> {
  const snapshot = await apiRequest<SnapshotItem[]>("DashboardAPIHandler?enquiry=snapshot");
  const panel = snapshot.find((p) => p.metadata?.panel_id === panelId);
  const logs = panel?.recent_logs || [];
  const latest = logs[0] || {};

  return {
    panelId,
    reportedAtUtc: latest.timestamp ? new Date(Number(latest.timestamp)).toISOString() : new Date().toISOString(),
    phase1Voltage: latest.R3027 || 0,
    avgVoltage: latest.R3035 || 0,
    gridFrequency: latest.R3109 || 0,
    powerFactorPh1: latest.R3059 || 0,
    totalPowerFactor: latest.R3053 || 0,
    avgCurrent: latest.R3009 || 0,
    powerVector: latest.R3083 || 0,
  };
}

export async function postPanelCommand(
  panelId: string,
  payload: PanelCommandPayload
): Promise<PanelCommandResult> {
  let patchBody: any = { panel_id: panelId };
  
  if (payload.action === "SET_MANUAL_STATE") {
    patchBody.desired_state = payload.manualState;
  } else if (payload.action === "UPDATE_RTC_SCHEDULE") {
    patchBody.schedule = payload.schedule;
  }

  await apiRequest<any>(`DashboardAPIHandler`, {
    method: "PATCH",
    body: patchBody,
  });

  return {
    requestId: Math.random().toString(36).slice(2),
    accepted: true,
    updatedDesiredAtUtc: new Date().toISOString(),
  };
}

export async function getPanelTelemetry(input: {
  panelId: string;
  startUtcIso: string;
  endUtcIso: string;
}): Promise<TelemetryResponse> {
  const startTs = new Date(input.startUtcIso).getTime();
  const endTs = new Date(input.endUtcIso).getTime();
  
  const logs = await apiRequest<any[]>(
    `DashboardAPIHandler?enquiry=history&panel_id=${input.panelId}&start=${startTs}&end=${endTs}`
  );

  const points = (logs || []).map((log: any) => ({
    timestampUtc: log.timestamp ? new Date(Number(log.timestamp)).toISOString() : new Date().toISOString(),
    phase1Voltage: log.R3027 || 0,
    avgVoltage: log.R3035 || 0,
    gridFrequency: log.R3109 || 0,
    powerFactorPh1: log.R3059 || 0,
    totalPowerFactor: log.R3053 || 0,
    avgCurrent: log.R3009 || 0,
    powerVector: log.R3083 || 0,
  }));

  return {
    panelId: input.panelId,
    startUtc: input.startUtcIso,
    endUtc: input.endUtcIso,
    points,
  };
}

export async function createPanel(data: Partial<any>): Promise<void> {
  await apiRequest("DashboardAPIHandler", {
    method: "POST",
    body: data,
  });
}

export async function updatePanel(panelId: string, data: Partial<any>): Promise<void> {
  const patchData = { ...data, panel_id: panelId };
  await apiRequest("DashboardAPIHandler", {
    method: "PATCH",
    body: patchData,
  });
}

export async function getAlerts(
  severity?: AlertSeverity
): Promise<AlertListResponse> {
  const snapshot = await apiRequest<SnapshotItem[]>("DashboardAPIHandler?enquiry=snapshot");
  
  let items: AlertRecord[] = [];
  snapshot.forEach((item) => {
    if (item.metadata?.status === "FAULT") {
      items.push({
        alertId: `ALT-${item.metadata.panel_id}-${Date.now()}`,
        panelId: item.metadata.panel_id,
        severity: "CRITICAL",
        faultCode: item.metadata.faultCode || "E99",
        status: "ACTIVE",
        message: item.metadata.faultMessage || "System fault detected.",
        raisedAtUtc: new Date().toISOString(),
      });
    }
  });

  if (severity) {
    items = items.filter((i) => i.severity === severity);
  }

  return { items };
}

export async function acknowledgeAlert(
  alertId: string,
  operatorId: string
): Promise<AlertRecord> {
  // Mock acknowledge via PATCH since lambda handles panel metadata not alerts independently
  return {
    alertId,
    panelId: "Unknown",
    severity: "CRITICAL",
    faultCode: "O_ACK",
    status: "ACKNOWLEDGED",
    message: "Alert acknowledged by operator",
    raisedAtUtc: new Date().toISOString(),
    acknowledgedBy: operatorId,
    acknowledgedAtUtc: new Date().toISOString(),
  };
}
