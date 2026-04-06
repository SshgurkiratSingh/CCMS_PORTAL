export type PanelState = "ONLINE" | "OFFLINE" | "FAULT" | "UNKNOWN";

export type DashboardSummary = {
  totalPanels: number;
  activeAlarms: number;
  energyLast24hKwh: number;
  generatedAtUtc: string;
  // Real-time grid parameters snapshot (from latest node)
  gridAvgVoltage?: number;
  gridFrequency?: number;
  gridTotalPf?: number;
};

export type PanelRecord = {
  panelId: string;
  name: string;
  status: PanelState;
  gpsLat: number;
  gpsLng: number;
  deviceId: string;
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
  clientId?: string;
  timestamp?: number;
  reportedAtUtc: string;
  batteryVoltage: number;
  mainsVoltageRaw: number;
  mainsStatus: "ON" | "OFF" | string;
  tiltSwitch: number;
  temperature: number;
  r3003: number;
  // Schneider Meter Variables
  phase1Voltage: number;    // R3027
  avgVoltage: number;       // R3035
  gridFrequency: number;    // R3109
  powerFactorPh1: number;   // R3059
  totalPowerFactor: number; // R3053
  avgCurrent: number;       // R3009
  powerVector: number;      // R3083
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
  timestamp?: number;
  clientId?: string;
  batteryVoltage: number;
  mainsVoltageRaw: number;
  mainsStatus?: "ON" | "OFF" | string;
  tiltSwitch: number;
  temperature: number;
  r3003: number;
  phase1Voltage: number;    // R3027
  avgVoltage: number;       // R3035
  gridFrequency: number;    // R3109
  powerFactorPh1: number;   // R3059
  totalPowerFactor: number; // R3053
  avgCurrent: number;       // R3009
  powerVector: number;      // R3083
  kwh?: number;             // Extrapolated energy placeholder
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
