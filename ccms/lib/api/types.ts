export type PanelState = "ONLINE" | "OFFLINE" | "FAULT" | "UNKNOWN";

export type DashboardSummary = {
  totalPanels: number;
  activeAlarms: number;
  energyLast24hKwh: number;
  generatedAtUtc: string;
};

export type PanelRecord = {
  panelId: string;
  name: string;
  status: PanelState;
  gpsLat: number;
  gpsLng: number;
  macAddress: string;
  firmwareVersion: string;
  lastSeenUtc: string;
};

export type PanelListResponse = {
  items: PanelRecord[];
  total: number;
  limit: number;
  offset: number;
};

export type PanelLiveStatus = {
  panelId: string;
  reportedAtUtc: string;
  voltage: number;
  current: number;
  kwh: number;
  frequencyHz?: number;
};

export type PanelCommandPayload =
  | {
      action: "SET_MANUAL_STATE";
      manualState: "ON" | "OFF";
    }
  | {
      action: "UPDATE_RTC_SCHEDULE";
      schedule: {
        startLocalTime: string;
        endLocalTime: string;
      };
    };

export type PanelCommandResult = {
  requestId: string;
  accepted: boolean;
  updatedDesiredAtUtc: string;
};

export type TelemetryPoint = {
  timestampUtc: string;
  phaseAkw: number;
  phaseBkw: number;
  phaseCkw: number;
  totalKw: number;
};

export type TelemetryResponse = {
  panelId: string;
  startUtc: string;
  endUtc: string;
  points: TelemetryPoint[];
};

export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type AlertRecord = {
  alertId: string;
  panelId: string;
  severity: AlertSeverity;
  faultCode: string;
  status: "ACTIVE" | "ACKNOWLEDGED";
  message: string;
  raisedAtUtc: string;
  acknowledgedBy?: string;
  acknowledgedAtUtc?: string;
};

export type AlertListResponse = {
  items: AlertRecord[];
};
