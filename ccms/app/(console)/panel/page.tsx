"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  postPanelCommand,
  getPanelStatus,
  getPanelTelemetry,
  getPanels,
} from "@/lib/api/ccms-api";
import type { PanelLiveStatus, TelemetryPoint, PanelRecord, PanelCommandPayload } from "@/lib/api/types";
import registerMap from "@/lib/register-map.json";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Activity, ArrowLeft, Zap, Power, Settings2, AlertTriangle,
  CheckCircle2, Clock, History, Edit, MapPin, RefreshCw,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { Button, Card, Input } from "@heroui/react";
import { ErrorBanner, SuccessBanner, WarningBanner, PanelStatusChip } from "@/components/ui";

const FleetMap = dynamic(() => import("@/components/fleet-map"), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-64 w-full flex items-center justify-center text-slate-500 text-sm gap-2">
      <Activity className="animate-spin h-5 w-5" /> Loading map...
    </div>
  ),
});

const TELEMETRY_REGISTERS = registerMap.registers.filter((r) => r.category !== "Control");
const CHART_REGISTERS = TELEMETRY_REGISTERS.filter(
  (r) => ["avgVoltage", "avgCurrent", "gridFrequency", "temperature", "totalPowerFactor"].includes(r.id)
);

export default function PanelDetailsPage() {
  const searchParams = useSearchParams();
  const panelId = searchParams.get("id") ?? "";

  const [status, setStatus] = useState<PanelLiveStatus | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [panelInfo, setPanelInfo] = useState<PanelRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const [timeRange, setTimeRange] = useState<"1H" | "24H" | "7D" | "Custom">("1H");
  const [customRange, setCustomRange] = useState({
    start: format(new Date(Date.now() - 24 * 3600 * 1000), "yyyy-MM-dd'T'HH:mm"),
    end: format(new Date(), "yyyy-MM-dd'T'HH:mm")
  });
  const [manualState, setManualState] = useState<"ON" | "OFF">("ON");
  const [scheduleStart, setScheduleStart] = useState("18:00");
  const [scheduleEnd, setScheduleEnd] = useState("06:00");
  const [dispatching, setDispatching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Shadow keys state
  const [relayState, setRelayState] = useState<"ON" | "OFF">("ON");
  const [deviceState, setDeviceState] = useState<"ON" | "OFF">("ON");
  const [timeToAutoTurnOn, setTimeToAutoTurnOn] = useState("18:00");
  const [timeToAutoTurnOff, setTimeToAutoTurnOff] = useState("06:00");

  const loadData = useCallback(async () => {
    if (!panelId) return;
    setLoading(true);
    try {
      let endUtc = new Date();
      let startUtc = new Date();
      
      if (timeRange === "1H") {
        startUtc.setHours(startUtc.getHours() - 1);
      } else if (timeRange === "24H") {
        startUtc.setHours(startUtc.getHours() - 24);
      } else if (timeRange === "7D") {
        startUtc.setDate(startUtc.getDate() - 7);
      } else if (timeRange === "Custom") {
        startUtc = new Date(customRange.start);
        endUtc = new Date(customRange.end);
      }

      const [nextStatus, nextTelemetry, panelsResponse] = await Promise.all([
        getPanelStatus(panelId),
        getPanelTelemetry({ panelId, startUtcIso: startUtc.toISOString(), endUtcIso: endUtc.toISOString() }),
        getPanels({ limit: 1000 }),
      ]);

      setStatus(nextStatus);
      setPanelInfo(panelsResponse.items.find((x) => x.panelId === panelId) ?? null);
      setTelemetry(
        nextTelemetry.points.sort(
          (a, b) => new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime()
        )
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to fetch live panel data.");
    } finally {
      setLoading(false);
    }
  }, [panelId, timeRange, customRange.start, customRange.end]);

  useEffect(() => {
    if (!panelId) return;
    void loadData();
    const timer = setInterval(() => void loadData(), 30_000);
    return () => clearInterval(timer);
  }, [loadData, panelId, timeRange, customRange.start, customRange.end]);

  const sendManualCommand = async () => {
    if (!panelId) return;
    setDispatching(true);
    try {
      const result = await postPanelCommand(panelId, { action: "SET_MANUAL_STATE", manualState });
      setMessage(`Relay ${manualState} dispatched — request ${result.requestId}`);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Manual command failed.");
    } finally {
      setDispatching(false);
    }
  };

  const sendScheduleCommand = async () => {
    if (!panelId) return;
    setDispatching(true);
    try {
      const result = await postPanelCommand(panelId, {
        action: "UPDATE_RTC_SCHEDULE",
        schedule: { startLocalTime: scheduleStart, endLocalTime: scheduleEnd },
      });
      setMessage(`RTC schedule synced — request ${result.requestId}`);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Schedule command failed.");
    } finally {
      setDispatching(false);
    }
  };

  const sendShadowKeysCommand = async () => {
    if (!panelId) return;
    setDispatching(true);
    try {
      const shadowKeys: PanelCommandPayload = {
        action: "UPDATE_SHADOW_KEYS",
        shadowKeys: {
          relay_state: relayState,
          device_state: deviceState,
          timeToAutoTurnOn,
          timeToAutoTurnOff,
        },
      };
      const result = await postPanelCommand(panelId, shadowKeys);
      setMessage(`Shadow keys updated — request ${result.requestId}`);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Shadow keys update failed.");
    } finally {
      setDispatching(false);
    }
  };

  // Insights
  const insights: { type: "ok" | "warning"; text: string }[] = [];
  if (status) {
    if (status.avgVoltage < 210)
      insights.push({ type: "warning", text: `Low voltage: ${status.avgVoltage.toFixed(1)} V (< 210 V)` });
    else if (status.avgVoltage > 250)
      insights.push({ type: "warning", text: `Over voltage: ${status.avgVoltage.toFixed(1)} V (> 250 V)` });
    else
      insights.push({ type: "ok", text: `Voltage nominal at ${status.avgVoltage.toFixed(1)} V` });

    if (status.totalPowerFactor < 0.85)
      insights.push({ type: "warning", text: `Poor power factor: ${status.totalPowerFactor.toFixed(2)} (< 0.85)` });
    else
      insights.push({ type: "ok", text: `Power factor stable at ${status.totalPowerFactor.toFixed(2)}` });

    if (status.tiltSwitch > 0)
      insights.push({ type: "warning", text: `Door status: OPEN (1) - Panel compromised or door left open` });
    else
      insights.push({ type: "ok", text: `Door status: CLOSED (0) - Secure` });

    if (status.gridFrequency < 49.5 || status.gridFrequency > 50.5)
      insights.push({ type: "warning", text: `Frequency unstable: ${status.gridFrequency.toFixed(2)} Hz` });
    else
      insights.push({ type: "ok", text: `Grid frequency stable at ${status.gridFrequency.toFixed(2)} Hz` });
  }

  const hasWarning = insights.some((i) => i.type === "warning");

  return (
    <section className="space-y-5 pb-12">

      {/* ── Page header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="space-y-2">
          <Link
            href="/panels"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Fleet
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-slate-50">
              Node Dashboard
            </h2>
            <code className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/80 text-sm font-mono text-cyan-300">
              {panelId || "—"}
            </code>
            {panelInfo && <PanelStatusChip status={panelInfo.status} />}
            {panelId && (
              <Link
                href={`/manage-panel?id=${panelId}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/70 border border-slate-700/60 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                <Edit className="h-3 w-3" /> Edit
              </Link>
            )}
          </div>
          {panelInfo && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              {status?.clientId && (
                <span>
                  Client <span className="font-mono text-slate-300">{status.clientId}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {panelInfo.name !== panelInfo.panelId ? panelInfo.name : `${panelInfo.gpsLat.toFixed(4)}, ${panelInfo.gpsLng.toFixed(4)}`}
              </span>
              <span>FW v{panelInfo.firmwareVersion}</span>
              <span>
                Last seen{" "}
                {formatDistanceToNow(parseISO(panelInfo.lastSeenUtc), { addSuffix: true })}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {status && (
            <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Live
            </div>
          )}
          <Button
            variant="secondary"
            onPress={() => void loadData()}
            isDisabled={loading}
            className="flex items-center gap-1.5 text-sm"
            size="sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {!panelId && <WarningBanner message="Open this page as /panel?id=your-panel-id." />}
      {error && <ErrorBanner message={error} />}
      {message && <SuccessBanner message={message} />}

      {/* ── Insights strip ── */}
      {insights.length > 0 && (
        <div className={`flex flex-wrap gap-2 rounded-xl border p-3 ${hasWarning ? "border-amber-800/40 bg-amber-950/15" : "border-emerald-800/30 bg-emerald-950/10"}`}>
          {insights.map((insight, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-xs">
              {insight.type === "warning"
                ? <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
              <span className={insight.type === "warning" ? "text-amber-300" : "text-emerald-300"}>
                {insight.text}
              </span>
              {idx < insights.length - 1 && <span className="ml-2 text-slate-700">·</span>}
            </div>
          ))}
        </div>
      )}

      {status && (
        <Card className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3">
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <p className="text-slate-500 uppercase tracking-wide">Mains Status</p>
              <p className={status.mainsStatus === "ON" ? "font-semibold text-emerald-400" : "font-semibold text-rose-400"}>
                {status.mainsStatus}
              </p>
            </div>
            <div>
              <p className="text-slate-500 uppercase tracking-wide">Door status</p>
              <p className={status.tiltSwitch > 0 ? "font-semibold text-amber-400" : "font-semibold text-slate-300"}>
                {status.tiltSwitch > 0 ? "OPEN (1)" : "CLOSED (0)"}
              </p>
            </div>
            <div>
              <p className="text-slate-500 uppercase tracking-wide">Battery</p>
              <p className="font-semibold text-slate-200">{status.batteryVoltage.toFixed(2)} V</p>
            </div>
            <div>
              <p className="text-slate-500 uppercase tracking-wide">Temperature</p>
              <p className="font-semibold text-slate-200">{status.temperature.toFixed(1)} C</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── KPI snapshot ── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-7">
        {TELEMETRY_REGISTERS.map((reg) => {
          let valStr = "—";
          let isAlert = false;
          const isHighlight = reg.category === "Current";

          if (status) {
            const v = status[reg.id as keyof typeof status];
            if (v !== undefined) {
              const n = Number(v);
              valStr = `${n.toFixed(reg.id.includes("Factor") ? 3 : 1)}${reg.unit ? ` ${reg.unit}` : ""}`;
              if (reg.category === "Voltage" && (n > 250 || n < 210)) isAlert = true;
              if (reg.id === "totalPowerFactor" && n < 0.85) isAlert = true;
            }
          }

          return (
            <StatBox
              key={reg.id}
              label={reg.name}
              value={valStr}
              color={reg.chartColor}
              alert={isAlert}
              highlight={isHighlight}
              loading={loading && !status}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-1.5 text-xs text-slate-500 -mt-1">
        <Clock className="h-3 w-3" />
        {status?.reportedAtUtc
          ? <>Reported {format(parseISO(status.reportedAtUtc), "dd MMM, HH:mm:ss")} UTC</>
          : "Awaiting shadow read"}
      </div>

      {/* ── Historical charts ── */}
      <div className="space-y-4 pt-4 border-t border-slate-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-semibold text-base flex items-center gap-2 text-slate-200">
            <History className="h-4 w-4 text-indigo-400" /> Historical Feed
          </h3>
          <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800/80">
            {(["1H", "24H", "7D", "Custom"] as const).map((range) => (
              <Button
                key={range}
                size="sm"
                variant={timeRange === range ? "primary" : "ghost"}
                onPress={() => setTimeRange(range)}
                className={`px-3 text-xs font-semibold min-w-10 ${timeRange === range ? "text-slate-950 bg-indigo-400" : "text-slate-300 hover:text-slate-100"}`}
              >
                {range}
              </Button>
            ))}
          </div>
        </div>

        {timeRange === "Custom" && (
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-900/40 p-3 rounded-lg border border-slate-800/80 mt-2 text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs uppercase tracking-wider text-slate-500">From</span>
              <input 
                type="datetime-local" 
                className="w-48 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 text-sm"
                value={customRange.start} 
                onChange={(e) => setCustomRange((prev) => ({ ...prev, start: e.target.value }))} 
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs uppercase tracking-wider text-slate-500">To</span>
              <input 
                type="datetime-local" 
                className="w-48 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 text-sm"
                value={customRange.end} 
                onChange={(e) => setCustomRange((prev) => ({ ...prev, end: e.target.value }))} 
              />
            </div>
            <Button variant="primary" onPress={loadData} className="bg-indigo-500 text-white font-semibold text-sm" size="sm">
              <RefreshCw className="w-3 h-3 mr-1"/> Apply
            </Button>
          </div>
        )}

        {telemetry.length > 0 ? (
          <>
            <IntervalInsights data={telemetry} />
            <DataCorrelator data={telemetry} />
            <GraphAnomalyDetector data={telemetry} />
            <div className="grid gap-4 lg:grid-cols-2 mt-4">
              {CHART_REGISTERS.map((reg) => (
                <LiveChartCard
                  key={reg.id}
                  title={reg.name}
                  data={telemetry}
                  dataKey={reg.id as keyof TelemetryPoint}
                  color={reg.chartColor}
                  unit={reg.unit}
                  domain={
                    reg.id.includes("Voltage") ? [200, 260]
                    : reg.id.includes("Frequency") ? [49, 51]
                    : reg.id.includes("PowerFactor") ? [0, 1.1]
                    : undefined
                  }
                />
              ))}
            </div>
          </>
        ) : (
          <div className="py-14 text-center border border-slate-800/60 border-dashed rounded-xl bg-slate-900/20 text-slate-500 text-sm">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Activity className="h-4 w-4 animate-spin" /> Loading telemetry...
              </span>
            ) : (
              "No historical data found for this period."
            )}
          </div>
        )}
      </div>

      {/* ── Controls + Map ── */}
      <div className="grid gap-4 lg:grid-cols-3 pt-5 border-t border-slate-800/80">
        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">

          {/* Relay control */}
          <Card className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity pointer-events-none">
              <Power className="h-24 w-24 text-cyan-300" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-cyan-400" />
              <h3 className="font-semibold text-slate-100">Relay Control</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Writes to device shadow via MQTT. Actuation typically takes ~2 s.
            </p>

            <div className="flex items-center gap-3 relative z-10">
              <div className="flex rounded-lg border border-slate-700 bg-slate-950 p-1 gap-1">
                <button
                  onClick={() => setManualState("ON")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    manualState === "ON"
                      ? "bg-emerald-500 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  ON
                </button>
                <button
                  onClick={() => setManualState("OFF")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    manualState === "OFF"
                      ? "bg-rose-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  OFF
                </button>
              </div>
              <Button
                variant="primary"
                onPress={() => void sendManualCommand()}
                isDisabled={dispatching}
                isPending={dispatching}
                className="flex items-center gap-1.5 text-sm"
                size="sm"
              >
                Dispatch
              </Button>
            </div>
          </Card>

          {/* RTC Schedule */}
          <Card className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity pointer-events-none">
              <Settings2 className="h-24 w-24 text-purple-300" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-purple-400" />
              <h3 className="font-semibold text-slate-100">RTC Schedule</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Device auto-actuates on daily intervals using onboard RTC.
            </p>

            <div className="flex flex-wrap items-end gap-3 relative z-10">
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Enable at</span>
                <input
                  type="time"
                  className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 text-sm"
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Disable at</span>
                <input
                  type="time"
                  className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 text-sm"
                  value={scheduleEnd}
                  onChange={(e) => setScheduleEnd(e.target.value)}
                />
              </label>
              <Button
                variant="secondary"
                onPress={() => void sendScheduleCommand()}
                isDisabled={dispatching}
                isPending={dispatching}
                size="sm"
              >
                Sync RTC
              </Button>
            </div>
          </Card>

          {/* Shadow Keys Control */}
          <Card className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity pointer-events-none">
              <Zap className="h-24 w-24 text-amber-300" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-amber-400" />
              <h3 className="font-semibold text-slate-100">Shadow Keys</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Directly update device shadow state values.
            </p>

            <div className="flex flex-wrap items-end gap-3 relative z-10">
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Relay State</span>
                <div className="flex rounded-lg border border-slate-700 bg-slate-950 p-1 gap-1">
                  <button
                    onClick={() => setRelayState("ON")}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      relayState === "ON"
                        ? "bg-emerald-500 text-slate-950 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    ON
                  </button>
                  <button
                    onClick={() => setRelayState("OFF")}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      relayState === "OFF"
                        ? "bg-rose-500 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    OFF
                  </button>
                </div>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Device State</span>
                <div className="flex rounded-lg border border-slate-700 bg-slate-950 p-1 gap-1">
                  <button
                    onClick={() => setDeviceState("ON")}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      deviceState === "ON"
                        ? "bg-emerald-500 text-slate-950 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    ON
                  </button>
                  <button
                    onClick={() => setDeviceState("OFF")}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      deviceState === "OFF"
                        ? "bg-rose-500 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    OFF
                  </button>
                </div>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Auto Turn On</span>
                <input
                  type="time"
                  className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 text-sm"
                  value={timeToAutoTurnOn}
                  onChange={(e) => setTimeToAutoTurnOn(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Auto Turn Off</span>
                <input
                  type="time"
                  className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 text-sm"
                  value={timeToAutoTurnOff}
                  onChange={(e) => setTimeToAutoTurnOff(e.target.value)}
                />
              </label>
              <Button
                variant="secondary"
                onPress={() => void sendShadowKeysCommand()}
                isDisabled={dispatching}
                isPending={dispatching}
                size="sm"
              >
                Update
              </Button>
            </div>
          </Card>
        </div>

        {/* Map */}
        <Card className="rounded-xl border border-slate-700/80 bg-slate-900/50 overflow-hidden flex flex-col min-h-56">
          <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between shrink-0">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <MapPin className="h-4 w-4 text-rose-400" /> Geography
            </span>
            {panelInfo && (
              <span className="text-[10px] font-mono text-slate-500">
                {panelInfo.gpsLat.toFixed(4)}, {panelInfo.gpsLng.toFixed(4)}
              </span>
            )}
          </div>
          <div className="flex-1 relative bg-slate-950 min-h-48">
            {panelInfo ? (
              <FleetMap
                panels={[panelInfo]}
                className="absolute inset-0 h-full w-full rounded-none border-none shadow-none"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
                <Activity className="h-5 w-5 animate-spin opacity-40" />
                Locating node...
              </div>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

// ── StatBox ───────────────────────────────────────────────────────────────────
function StatBox({
  label, value, color, alert, highlight, loading,
}: {
  label: string; value: string; color: string;
  alert?: boolean; highlight?: boolean; loading?: boolean;
}) {
  return (
    <Card
      className={`rounded-xl border p-4 flex flex-col gap-1 transition-all ${
        alert
          ? "border-rose-700/50 bg-rose-950/30 animate-pulse"
          : highlight
          ? "border-slate-700/60 bg-slate-900/60"
          : "border-slate-800/60 bg-slate-900/40"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 truncate">
        {label}
      </p>
      {loading ? (
        <div className="h-6 w-16 rounded bg-slate-800 animate-pulse mt-0.5" />
      ) : (
        <p
          className="text-lg font-bold font-mono"
          style={{ color: alert ? "#fca5a5" : color }}
        >
          {value}
        </p>
      )}
    </Card>
  );
}

// ── LiveChartCard ─────────────────────────────────────────────────────────────
function LiveChartCard({
  title, data, dataKey, color, unit, domain,
}: {
  title: string; data: TelemetryPoint[]; dataKey: keyof TelemetryPoint;
  color: string; unit: string; domain?: [number, number];
}) {
  const last = data.length > 0 ? (data[data.length - 1] as Record<string, unknown>)[dataKey as string] : null;
  const valDisplay = last != null ? Number(last).toFixed(2) : "—";

  return (
    <Card className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-4 flex flex-col">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800/60">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{title}</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold font-mono" style={{ color }}>{valDisplay}</span>
          {unit && <span className="text-xs text-slate-500">{unit}</span>}
        </div>
      </div>
      <div className="h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="timestampUtc"
              tickFormatter={(t) => { try { return format(parseISO(t), "HH:mm"); } catch { return t; } }}
              stroke="#475569"
              fontSize={10}
              minTickGap={24}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={domain ?? ["auto", "auto"]}
              stroke="#475569"
              fontSize={10}
              tickFormatter={(t) => Number(t).toFixed(0)}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: "8px", fontSize: "11px" }}
              itemStyle={{ color, fontWeight: "bold" }}
              labelFormatter={(l) => { try { return format(parseISO(l as string), "HH:mm:ss"); } catch { return l; } }}
            />
            <Line
              type="monotone"
              isAnimationActive={false}
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: color, stroke: "#0f172a", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ── IntervalInsights ──────────────────────────────────────────────────────────
function IntervalInsights({ data }: { data: TelemetryPoint[] }) {
  if (!data.length) return null;

  const n = data.length;
  const avgV = data.reduce((s, p) => s + p.avgVoltage, 0) / n;
  const avgA = data.reduce((s, p) => s + p.avgCurrent, 0) / n;
  const avgPF = data.reduce((s, p) => s + p.totalPowerFactor, 0) / n;
  const voltages = data.map((p) => p.avgVoltage);
  const maxV = Math.max(...voltages);
  const minV = Math.min(...voltages);
  const stdV = Math.sqrt(data.reduce((s, p) => s + (p.avgVoltage - avgV) ** 2, 0) / n);
  const totalKwh = data.reduce((s, p) => s + (p.kwh ?? 0), 0);

  const stats = [
    { label: "Avg Voltage", value: `${avgV.toFixed(1)} V`, color: "#2dd4bf" },
    { label: "Peak Voltage", value: `${maxV.toFixed(1)} V`, color: "#fb7185" },
    { label: "Min Voltage", value: `${minV.toFixed(1)} V`, color: "#fbbf24" },
    { label: "Voltage σ", value: `${stdV.toFixed(2)} V`, color: stdV > 5 ? "#fb7185" : "#94a3b8" },
    { label: "Avg Current", value: `${avgA.toFixed(2)} A`, color: "#a78bfa" },
    { label: "Avg PF", value: avgPF.toFixed(3), color: avgPF < 0.85 ? "#fb7185" : "#34d399" },
    { label: "Energy (period)", value: totalKwh > 0 ? `${totalKwh.toFixed(2)} kWh` : "N/A", color: "#facc15" },
  ];

  return (
    <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-1">{s.label}</p>
          <p className="text-sm font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}
function DataCorrelator({ data }: { data: TelemetryPoint[] }) {
  if (!data || data.length < 2) return null;

  const anomalies: { time: string; msg: string; severity: "high" | "medium" | "low" }[] = [];
  const patterns: { time: string; msg: string; severity: "high" | "medium" | "low" }[] = [];

  // Calculate statistical baselines
  const voltages = data.map(p => p.avgVoltage);
  const avgVoltage = voltages.reduce((a, b) => a + b, 0) / voltages.length;
  const voltageStd = Math.sqrt(voltages.reduce((a, b) => a + Math.pow(b - avgVoltage, 2), 0) / voltages.length);
  
  const currents = data.map(p => p.avgCurrent);
  const avgCurrent = currents.reduce((a, b) => a + b, 0) / currents.length;
  
  const powerFactors = data.map(p => p.totalPowerFactor);
  const avgPowerFactor = powerFactors.reduce((a, b) => a + b, 0) / powerFactors.length;

  // Track door status changes
  const doorEvents: { time: string; status: number; voltage: number; current: number }[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    
    // Door status monitoring (0=closed, 1=open)
    if (point.tiltSwitch > 0) {
      doorEvents.push({
        time: point.timestampUtc,
        status: point.tiltSwitch,
        voltage: point.avgVoltage,
        current: point.avgCurrent
      });
      
      // Check if door opened during low voltage conditions
      if (point.avgVoltage < 210) {
        anomalies.push({ 
          time: point.timestampUtc, 
          msg: `Door OPENED during low voltage (${point.avgVoltage.toFixed(1)}V) - Possible tampering`, 
          severity: "high" 
        });
      }
      
      // Check if door opened during high current (lights on)
      if (point.avgCurrent > avgCurrent * 1.5) {
        anomalies.push({ 
          time: point.timestampUtc, 
          msg: `Door OPENED while lights active (${point.avgCurrent.toFixed(1)}A) - Unusual activity`, 
          severity: "medium" 
        });
      }
    }
    
    // Statistical anomaly detection (3 sigma rule)
    if (Math.abs(point.avgVoltage - avgVoltage) > voltageStd * 3) {
      anomalies.push({ 
        time: point.timestampUtc, 
        msg: `Extreme voltage deviation: ${point.avgVoltage.toFixed(1)}V (avg: ${avgVoltage.toFixed(1)}V)`, 
        severity: "high" 
      });
    }
    
    // Power factor degradation pattern
    if (point.totalPowerFactor < 0.7 && avgPowerFactor > 0.85) {
      anomalies.push({ 
        time: point.timestampUtc, 
        msg: `Severe power factor degradation: ${point.totalPowerFactor.toFixed(2)} (normally ${avgPowerFactor.toFixed(2)})`, 
        severity: "medium" 
      });
    }
  }

  // Pattern detection across time series
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    
    // Detect voltage spikes/drops > 10% between consecutive reported intervals
    const vDiff = Math.abs(curr.avgVoltage - prev.avgVoltage);
    if (prev.avgVoltage > 0 && (vDiff / prev.avgVoltage) > 0.1) {
      if (curr.avgVoltage > prev.avgVoltage) {
         anomalies.push({ time: curr.timestampUtc, msg: `Sudden Voltage Spike: ${prev.avgVoltage.toFixed(1)}V ➔ ${curr.avgVoltage.toFixed(1)}V`, severity: "high" });
      } else {
         anomalies.push({ time: curr.timestampUtc, msg: `Sudden Voltage Drop: ${prev.avgVoltage.toFixed(1)}V ➔ ${curr.avgVoltage.toFixed(1)}V`, severity: "high" });
      }
    }

    // Detect sudden PF drops
    if (prev.totalPowerFactor > 0.8 && curr.totalPowerFactor < 0.7) {
      anomalies.push({ time: curr.timestampUtc, msg: `Abnormal Power Factor collapse: ${prev.totalPowerFactor.toFixed(2)} ➔ ${curr.totalPowerFactor.toFixed(2)}`, severity: "medium" });
    }

    // Current anomaly (lights acting up)
    const iDiff = Math.abs(curr.avgCurrent - prev.avgCurrent);
    if (prev.avgCurrent > 1 && (iDiff / prev.avgCurrent) > 0.5) {
       anomalies.push({ time: curr.timestampUtc, msg: `Large Current fluctuation: ${prev.avgCurrent.toFixed(1)}A ➔ ${curr.avgCurrent.toFixed(1)}A`, severity: "medium" });
    }
    
    // Door status change detection
    if (prev.tiltSwitch === 0 && curr.tiltSwitch > 0) {
      patterns.push({ 
        time: curr.timestampUtc, 
        msg: `Door opened (0→${curr.tiltSwitch})`, 
        severity: "medium" 
      });
    } else if (prev.tiltSwitch > 0 && curr.tiltSwitch === 0) {
      patterns.push({ 
        time: curr.timestampUtc, 
        msg: `Door closed (${prev.tiltSwitch}→0)`, 
        severity: "low" 
      });
    }
    
    // Correlation: Voltage drop followed by door opening
    if (i > 1) {
      const prev2 = data[i - 2];
      if (prev2.avgVoltage > 220 && prev.avgVoltage < 210 && curr.tiltSwitch > 0) {
        patterns.push({
          time: curr.timestampUtc,
          msg: `Pattern: Voltage drop (${prev2.avgVoltage.toFixed(1)}V→${prev.avgVoltage.toFixed(1)}V) followed by door opening`, 
          severity: "high"
        });
      }
    }
  }
  
  // Time-based pattern analysis
  if (doorEvents.length > 0) {
    const doorOpenTimes = doorEvents.map(e => new Date(e.time).getHours());
    const unusualHours = doorOpenTimes.filter(h => h < 6 || h > 22); // Night hours
    if (unusualHours.length > 0) {
      patterns.push({
        time: data[data.length - 1].timestampUtc,
        msg: `${unusualHours.length} door openings detected during unusual hours (night/early morning)`, 
        severity: "high"
      });
    }
  }

  // Combine and sort by time (most recent first)
  const allFindings = [...anomalies, ...patterns]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  
  // Cap findings list to most recent 8 to avoid UI clutter
  const recentFindings = allFindings.slice(0, 8);

  if (recentFindings.length === 0) return null;
  
  // Categorize findings
  const highSeverity = recentFindings.filter(f => f.severity === "high");
  const mediumSeverity = recentFindings.filter(f => f.severity === "medium");
  const lowSeverity = recentFindings.filter(f => f.severity === "low");
  
  const hasHigh = highSeverity.length > 0;
  const hasMedium = mediumSeverity.length > 0;
  const hasLow = lowSeverity.length > 0;

  return (
    <div className={`mt-4 rounded-xl border p-4 ${hasHigh ? "border-rose-500/20 bg-rose-500/5" : hasMedium ? "border-amber-500/20 bg-amber-500/5" : "border-blue-500/20 bg-blue-500/5"}`}>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className={`h-4 w-4 ${hasHigh ? "text-rose-400" : hasMedium ? "text-amber-400" : "text-blue-400"}`} />
        <h4 className="text-sm font-semibold text-slate-200">Advanced Pattern Correlation Analysis</h4>
        <span className="ml-auto text-xs px-2 py-1 rounded-full bg-slate-800/60 text-slate-400">
          {recentFindings.length} findings
        </span>
      </div>
      
      <div className="mb-3 flex flex-wrap gap-2">
        {highSeverity.length > 0 && (
          <span className="text-xs px-2 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
            {highSeverity.length} High
          </span>
        )}
        {mediumSeverity.length > 0 && (
          <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {mediumSeverity.length} Medium
          </span>
        )}
        {lowSeverity.length > 0 && (
          <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
            {lowSeverity.length} Low
          </span>
        )}
      </div>
      
      <ul className="space-y-2 text-xs">
        {recentFindings.map((finding, i) => (
          <li key={i} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
            <span className="font-mono text-[10px] text-slate-500 shrink-0">
              {format(parseISO(finding.time), "dd MMM HH:mm:ss")}
            </span>
            <span className={`flex-1 ${finding.severity === "high" ? "text-rose-400" : finding.severity === "medium" ? "text-amber-400" : "text-blue-400"}`}>
              {finding.msg}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${finding.severity === "high" ? "bg-rose-500/20 text-rose-300" : finding.severity === "medium" ? "bg-amber-500/20 text-amber-300" : "bg-blue-500/20 text-blue-300"}`}>
              {finding.severity.toUpperCase()}
            </span>
          </li>
        ))}
      </ul>
      
      {doorEvents.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800/40 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="font-semibold">Door Activity:</span> 
            {doorEvents.length} opening(s) detected • 
            Last: {format(parseISO(doorEvents[doorEvents.length - 1]?.time || data[0].timestampUtc), "HH:mm")}
          </span>
        </div>
      )}
    </div>
  );
}

// ── GraphAnomalyDetector ──────────────────────────────────────────────────────
function GraphAnomalyDetector({ data }: { data: TelemetryPoint[] }) {
  if (!data || data.length < 10) return null;

  const anomalies: { metric: string; pattern: string; severity: "high" | "medium" | "low"; confidence: number }[] = [];
  
  // Analyze voltage patterns
  const voltages = data.map(p => p.avgVoltage);
  const voltageChanges = [];
  for (let i = 1; i < voltages.length; i++) {
    voltageChanges.push(Math.abs(voltages[i] - voltages[i-1]));
  }
  
  // Detect sudden voltage drops (more than 15V drop)
  const significantDrops = voltageChanges.filter(change => change > 15);
  if (significantDrops.length > 0) {
    anomalies.push({
      metric: "Voltage",
      pattern: `${significantDrops.length} sudden voltage drops (>15V change) detected`, 
      severity: "high",
      confidence: Math.min(0.9, significantDrops.length / 10)
    });
  }
  
  // Detect voltage oscillation patterns
  let oscillationCount = 0;
  for (let i = 2; i < voltages.length; i++) {
    const dir1 = voltages[i-1] - voltages[i-2];
    const dir2 = voltages[i] - voltages[i-1];
    if (Math.abs(dir1) > 5 && Math.abs(dir2) > 5 && dir1 * dir2 < 0) {
      oscillationCount++;
    }
  }
  if (oscillationCount > 3) {
    anomalies.push({
      metric: "Voltage",
      pattern: `Unstable voltage oscillation (${oscillationCount} direction changes)`, 
      severity: "medium",
      confidence: Math.min(0.8, oscillationCount / 20)
    });
  }
  
  // Analyze current patterns
  const currents = data.map(p => p.avgCurrent);
  const currentChanges = [];
  for (let i = 1; i < currents.length; i++) {
    currentChanges.push(Math.abs(currents[i] - currents[i-1]));
  }
  
  // Detect sudden current spikes (more than 50% increase)
  let spikeCount = 0;
  for (let i = 1; i < currents.length; i++) {
    if (currents[i-1] > 0.5 && currents[i] > currents[i-1] * 1.5) {
      spikeCount++;
    }
  }
  if (spikeCount > 0) {
    anomalies.push({
      metric: "Current",
      pattern: `${spikeCount} current spikes (>50% increase) detected`, 
      severity: "medium",
      confidence: Math.min(0.85, spikeCount / 5)
    });
  }
  
  // Analyze power factor patterns
  const powerFactors = data.map(p => p.totalPowerFactor);
  const lowPFCount = powerFactors.filter(pf => pf < 0.7).length;
  if (lowPFCount > powerFactors.length * 0.3) { // More than 30% of readings
    anomalies.push({
      metric: "Power Factor",
      pattern: `Extended low power factor period (${lowPFCount}/${powerFactors.length} readings < 0.7)`, 
      severity: "high",
      confidence: 0.9
    });
  }
  
  // Detect correlation between voltage drops and door openings
  const doorEvents = data.filter(p => p.tiltSwitch > 0);
  let voltageDropBeforeDoor = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i].tiltSwitch > 0 && data[i-1].tiltSwitch === 0) {
      // Door just opened, check previous voltage
      if (data[i-1].avgVoltage < 210) {
        voltageDropBeforeDoor++;
      }
    }
  }
  if (voltageDropBeforeDoor > 0 && doorEvents.length > 0) {
    anomalies.push({
      metric: "Correlation",
      pattern: `${voltageDropBeforeDoor}/${doorEvents.length} door openings occurred during low voltage`, 
      severity: "high",
      confidence: Math.min(0.95, voltageDropBeforeDoor / doorEvents.length)
    });
  }
  
  // Detect time-based patterns (nighttime anomalies)
  const nighttimeReadings = data.filter(p => {
    const hour = new Date(p.timestampUtc).getHours();
    return hour < 6 || hour > 22;
  });
  
  const nighttimeVoltageIssues = nighttimeReadings.filter(p => p.avgVoltage < 210 || p.avgVoltage > 250).length;
  if (nighttimeVoltageIssues > 0) {
    anomalies.push({
      metric: "Time Pattern",
      pattern: `${nighttimeVoltageIssues} voltage anomalies detected during nighttime hours`, 
      severity: "medium",
      confidence: Math.min(0.8, nighttimeVoltageIssues / 5)
    });
  }
  
  if (anomalies.length === 0) return null;
  
  // Sort by severity and confidence
  const sortedAnomalies = anomalies.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    if (severityOrder[b.severity] !== severityOrder[a.severity]) {
      return severityOrder[b.severity] - severityOrder[a.severity];
    }
    return b.confidence - a.confidence;
  });
  
  const highCount = sortedAnomalies.filter(a => a.severity === "high").length;
  const mediumCount = sortedAnomalies.filter(a => a.severity === "medium").length;
  const lowCount = sortedAnomalies.filter(a => a.severity === "low").length;
  
  return (
    <div className={`mt-4 rounded-xl border p-4 ${highCount > 0 ? "border-purple-500/20 bg-purple-500/5" : mediumCount > 0 ? "border-cyan-500/20 bg-cyan-500/5" : "border-green-500/20 bg-green-500/5"}`}>
      <div className="flex items-center gap-2 mb-3">
        <Activity className={`h-4 w-4 ${highCount > 0 ? "text-purple-400" : mediumCount > 0 ? "text-cyan-400" : "text-green-400"}`} />
        <h4 className="text-sm font-semibold text-slate-200">Graph Pattern Analysis</h4>
        <span className="ml-auto text-xs px-2 py-1 rounded-full bg-slate-800/60 text-slate-400">
          {sortedAnomalies.length} patterns
        </span>
      </div>
      
      <div className="mb-3 flex flex-wrap gap-2">
        {highCount > 0 && (
          <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
            {highCount} High
          </span>
        )}
        {mediumCount > 0 && (
          <span className="text-xs px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            {mediumCount} Medium
          </span>
        )}
        {lowCount > 0 && (
          <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">
            {lowCount} Low
          </span>
        )}
      </div>
      
      <div className="space-y-3">
        {sortedAnomalies.slice(0, 5).map((anomaly, i) => (
          <div key={i} className="p-3 rounded-lg border border-slate-800/40 bg-slate-900/30">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-semibold ${anomaly.severity === "high" ? "text-purple-300" : anomaly.severity === "medium" ? "text-cyan-300" : "text-green-300"}`}>
                {anomaly.metric}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${anomaly.severity === "high" ? "bg-purple-500/20 text-purple-300" : anomaly.severity === "medium" ? "bg-cyan-500/20 text-cyan-300" : "bg-green-500/20 text-green-300"}`}>
                  {anomaly.severity.toUpperCase()}
                </span>
                <span className="text-[10px] text-slate-500">
                  {(anomaly.confidence * 100).toFixed(0)}% conf
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-300">{anomaly.pattern}</p>
          </div>
        ))}
      </div>
      
      {sortedAnomalies.length > 5 && (
        <div className="mt-3 pt-3 border-t border-slate-800/40 text-xs text-slate-500 text-center">
          +{sortedAnomalies.length - 5} more patterns detected
        </div>
      )}
    </div>
  );
}
