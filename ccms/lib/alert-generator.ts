import type { TelemetryPoint, AlertRecord, AlertSeverity } from "./api/types";

export interface GeneratedAlert extends AlertRecord {
  detectionRule: string;
  detectionDetails: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate alerts from historical telemetry data by analyzing patterns
 */
export function generateAlertsFromTelemetry(
  panelId: string,
  telemetry: TelemetryPoint[]
): GeneratedAlert[] {
  if (!telemetry || telemetry.length < 2) return [];

  const alerts: GeneratedAlert[] = [];

  // Rule 1: Sustained Low Voltage (< 200V for more than 2 readings)
  const lowVoltageStreak = getLowVoltageStreak(telemetry);
  if (lowVoltageStreak.count >= 2) {
    alerts.push({
      alertId: generateId(),
      panelId,
      severity: "HIGH",
      faultCode: "E001",
      status: "ACTIVE",
      message: `Sustained low voltage: ${lowVoltageStreak.avgVoltage.toFixed(1)}V for ${lowVoltageStreak.count} readings`,
      raisedAtUtc: new Date().toISOString(),
      detectionRule: "Sustained Low Voltage",
      detectionDetails: `Average voltage dropped below 200V. Last readings: ${lowVoltageStreak.avgVoltage.toFixed(1)}V`,
    });
  }

  // Rule 2: Sustained High Voltage (> 250V for more than 2 readings)
  const highVoltageStreak = getHighVoltageStreak(telemetry);
  if (highVoltageStreak.count >= 2) {
    alerts.push({
      alertId: generateId(),
      panelId,
      severity: "HIGH",
      faultCode: "E002",
      status: "ACTIVE",
      message: `Sustained high voltage: ${highVoltageStreak.avgVoltage.toFixed(1)}V for ${highVoltageStreak.count} readings`,
      raisedAtUtc: new Date().toISOString(),
      detectionRule: "Sustained High Voltage",
      detectionDetails: `Average voltage exceeded 250V. Last readings: ${highVoltageStreak.avgVoltage.toFixed(1)}V`,
    });
  }

  // Rule 3: Power Factor Degradation (< 0.75 consistently)
  const pfDegradation = getPowerFactorDegradation(telemetry);
  if (pfDegradation.count >= 3) {
    alerts.push({
      alertId: generateId(),
      panelId,
      severity: "MEDIUM",
      faultCode: "E003",
      status: "ACTIVE",
      message: `Poor power factor trend: ${pfDegradation.avgPF.toFixed(3)} (threshold: 0.75)`,
      raisedAtUtc: new Date().toISOString(),
      detectionRule: "Power Factor Degradation",
      detectionDetails: `Power factor consistently below optimal. Average: ${pfDegradation.avgPF.toFixed(3)}`,
    });
  }

  // Rule 4: Frequency Instability (outside ±0.5Hz from 50Hz)
  const freqInstability = getFrequencyInstability(telemetry);
  if (freqInstability.count >= 3) {
    alerts.push({
      alertId: generateId(),
      panelId,
      severity: "MEDIUM",
      faultCode: "E004",
      status: "ACTIVE",
      message: `Grid frequency unstable: ${freqInstability.range}Hz (safe: 49.5-50.5Hz)`,
      raisedAtUtc: new Date().toISOString(),
      detectionRule: "Frequency Instability",
      detectionDetails: `Grid frequency variations detected outside safe operating range. Min: ${freqInstability.min.toFixed(2)}Hz, Max: ${freqInstability.max.toFixed(2)}Hz`,
    });
  }

  // Rule 5: Extreme Current Draw (sudden spike > 50% increase)
  const currentAnomaly = getExtremeCurrentDraw(telemetry);
  if (currentAnomaly) {
    alerts.push({
      alertId: generateId(),
      panelId,
      severity: "MEDIUM",
      faultCode: "E005",
      status: "ACTIVE",
      message: `Extreme current spike detected: ${currentAnomaly.before.toFixed(1)}A ➔ ${currentAnomaly.after.toFixed(1)}A`,
      raisedAtUtc: new Date().toISOString(),
      detectionRule: "Extreme Current Draw",
      detectionDetails: `Current increased by ${currentAnomaly.percentChange.toFixed(1)}%, suggesting load anomaly or device malfunction`,
    });
  }

  // Rule 6: Temperature Threshold Breach (> 60°C)
  const tempBreach = getTemperatureBreach(telemetry);
  if (tempBreach) {
    alerts.push({
      alertId: generateId(),
      panelId,
      severity: tempBreach.temp > 65 ? "CRITICAL" : "HIGH",
      faultCode: tempBreach.temp > 65 ? "E006" : "E007",
      status: "ACTIVE",
      message: `Temperature critical: ${tempBreach.temp.toFixed(1)}°C`,
      raisedAtUtc: new Date().toISOString(),
      detectionRule: "Temperature Threshold Breach",
      detectionDetails: `Controller temperature exceeded safe limits at ${tempBreach.temp.toFixed(1)}°C. Risk of device damage.`,
    });
  }

  return alerts;
}

function getLowVoltageStreak(
  data: TelemetryPoint[]
): { count: number; avgVoltage: number } {
  let streak = 0;
  let sum = 0;

  for (const point of data) {
    if (point.avgVoltage < 200) {
      streak++;
      sum += point.avgVoltage;
    } else {
      break;
    }
  }

  return { count: streak, avgVoltage: streak > 0 ? sum / streak : 0 };
}

function getHighVoltageStreak(
  data: TelemetryPoint[]
): { count: number; avgVoltage: number } {
  let streak = 0;
  let sum = 0;

  for (const point of data) {
    if (point.avgVoltage > 250) {
      streak++;
      sum += point.avgVoltage;
    } else {
      break;
    }
  }

  return { count: streak, avgVoltage: streak > 0 ? sum / streak : 0 };
}

function getPowerFactorDegradation(
  data: TelemetryPoint[]
): { count: number; avgPF: number } {
  let count = 0;
  let sum = 0;

  for (const point of data) {
    if (point.totalPowerFactor < 0.75) {
      count++;
      sum += point.totalPowerFactor;
    }
  }

  return { count, avgPF: count > 0 ? sum / count : 1 };
}

function getFrequencyInstability(
  data: TelemetryPoint[]
): { count: number; min: number; max: number; range: string } {
  let unstableCount = 0;
  let min = 50;
  let max = 50;

  for (const point of data) {
    if (point.gridFrequency < 49.5 || point.gridFrequency > 50.5) {
      unstableCount++;
    }
    min = Math.min(min, point.gridFrequency);
    max = Math.max(max, point.gridFrequency);
  }

  return {
    count: unstableCount,
    min,
    max,
    range: `${min.toFixed(2)}-${max.toFixed(2)}`,
  };
}

function getExtremeCurrentDraw(data: TelemetryPoint[]): {
  before: number;
  after: number;
  percentChange: number;
} | null {
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    const percentChange = ((curr.avgCurrent - prev.avgCurrent) / prev.avgCurrent) * 100;

    if (prev.avgCurrent > 1 && percentChange > 50) {
      return {
        before: prev.avgCurrent,
        after: curr.avgCurrent,
        percentChange,
      };
    }
  }

  return null;
}

function getTemperatureBreach(data: TelemetryPoint[]): { temp: number } | null {
  for (const point of data) {
    if (point.temperature > 60) {
      return { temp: point.temperature };
    }
  }

  return null;
}
