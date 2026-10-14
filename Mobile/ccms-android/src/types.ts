export type RawTelemetry = Record<string, unknown> & { timestamp?: string | number };

export type RawSnapshotItem = {
  metadata?: Record<string, unknown>;
  recent_logs?: RawTelemetry[];
};

export type Panel = {
  id: string;
  name: string;
  status: string;
  deviceId: string;
  latest?: RawTelemetry;
};
