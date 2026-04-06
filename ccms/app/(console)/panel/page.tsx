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
import type { PanelLiveStatus, TelemetryPoint, PanelRecord } from "@/lib/api/types";
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
  (r) => (r.priority === "high" || r.priority === "medium") && r.id !== "phase1Voltage"
).slice(0, 4);

export default function PanelDetailsPage() {
  const searchParams = useSearchParams();
  const panelId = searchParams.get("id") ?? "";

  const [status, setStatus] = useState<PanelLiveStatus | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [panelInfo, setPanelInfo] = useState<PanelRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const [timeRange, setTimeRange] = useState<"1H" | "24H" | "7D">("1H");
  const [manualState, setManualState] = useState<"ON" | "OFF">("ON");
  const [scheduleStart, setScheduleStart] = useState("18:00");
  const [scheduleEnd, setScheduleEnd] = useState("06:00");
  const [dispatching, setDispatching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!panelId) return;
    setLoading(true);
    try {
      const endUtc = new Date();
      const startUtc = new Date();
      if (timeRange === "1H") startUtc.setHours(startUtc.getHours() - 1);
      else if (timeRange === "24H") startUtc.setHours(startUtc.getHours() - 24);
      else startUtc.setDate(startUtc.getDate() - 7);

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
  }, [panelId, timeRange]);

  useEffect(() => {
    if (!panelId) return;
    void loadData();
    const timer = setInterval(() => void loadData(), 30_000);
    return () => clearInterval(timer);
  }, [loadData, panelId, timeRange]);

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
            size="sm"
            variant="secondary"
            onPress={() => void loadData()}
            isDisabled={loading}
            className="flex items-center gap-1.5"
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
              <p className="text-slate-500 uppercase tracking-wide">Tilt Switch</p>
              <p className={status.tiltSwitch > 0 ? "font-semibold text-amber-400" : "font-semibold text-slate-300"}>
                {status.tiltSwitch > 0 ? "TRIGGERED" : "NORMAL"}
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
            {(["1H", "24H", "7D"] as const).map((range) => (
              <Button
                key={range}
                size="sm"
                variant={timeRange === range ? "primary" : "ghost"}
                onPress={() => setTimeRange(range)}
                className={`px-3 text-xs font-semibold min-w-10 ${timeRange === range ? "text-slate-950" : "text-slate-300 hover:text-slate-100"}`}
              >
                {range}
              </Button>
            ))}
          </div>
        </div>

        {telemetry.length > 0 ? (
          <>
            <IntervalInsights data={telemetry} />
            <div className="grid gap-4 lg:grid-cols-2">
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
                size="sm"
                variant="primary"
                onPress={() => void sendManualCommand()}
                isDisabled={dispatching}
                isPending={dispatching}
                className="flex items-center gap-1.5"
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
                <Input
                  type="time"
                  variant="secondary"
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Disable at</span>
                <Input
                  type="time"
                  variant="secondary"
                  value={scheduleEnd}
                  onChange={(e) => setScheduleEnd(e.target.value)}
                />
              </label>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => void sendScheduleCommand()}
                isDisabled={dispatching}
                isPending={dispatching}
              >
                Sync RTC
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
