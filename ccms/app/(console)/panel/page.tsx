"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  postPanelCommand,
  getPanelStatus,
  getPanelTelemetry,
} from "@/lib/api/ccms-api";
import type { PanelLiveStatus, TelemetryPoint } from "@/lib/api/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Activity,
  ArrowLeft,
  Zap,
  Power,
  Settings2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  BarChart2,
  Edit,
} from "lucide-react";
import { format, parseISO } from "date-fns";

export default function PanelDetailsPage() {
  const searchParams = useSearchParams();
  const panelId = searchParams.get("id") ?? "";

  const [status, setStatus] = useState<PanelLiveStatus | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);

  const [timeRange, setTimeRange] = useState<"1H" | "24H" | "7D">("1H");
  const [manualState, setManualState] = useState<"ON" | "OFF">("ON");
  const [scheduleStart, setScheduleStart] = useState("18:00");
  const [scheduleEnd, setScheduleEnd] = useState("06:00");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!panelId) return;

    try {
      const endUtc = new Date();
      const startUtc = new Date();
      if (timeRange === "1H") startUtc.setHours(startUtc.getHours() - 1);
      else if (timeRange === "24H") startUtc.setHours(startUtc.getHours() - 24);
      else if (timeRange === "7D") startUtc.setDate(startUtc.getDate() - 7);

      const [nextStatus, nextTelemetry] = await Promise.all([
        getPanelStatus(panelId),
        getPanelTelemetry({
          panelId,
          startUtcIso: startUtc.toISOString(),
          endUtcIso: endUtc.toISOString(),
        }),
      ]);

      setStatus(nextStatus);

      // Sort telemetry strictly chronologically for charts
      const sortedPts = nextTelemetry.points.sort(
        (a, b) =>
          new Date(a.timestampUtc).getTime() -
          new Date(b.timestampUtc).getTime(),
      );
      setTelemetry(sortedPts);

      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to fetch live panel data.",
      );
    }
  }, [panelId, timeRange]);

  useEffect(() => {
    if (!panelId) return;

    void loadData();
    const timer = setInterval(() => {
      void loadData();
    }, 30000); // 30s refresh for wider intervals

    return () => clearInterval(timer);
  }, [loadData, panelId, timeRange]);

  const sendManualCommand = async () => {
    if (!panelId) {
      setError("Missing panel id in URL. Use /panel?id=<panelId>.");
      return;
    }

    try {
      const result = await postPanelCommand(panelId, {
        action: "SET_MANUAL_STATE",
        manualState,
      });
      setMessage(`Command accepted: ${result.requestId}`);
      setError(null);
    } catch (commandError) {
      setError(
        commandError instanceof Error
          ? commandError.message
          : "Manual command failed.",
      );
    }
  };

  const sendScheduleCommand = async () => {
    if (!panelId) {
      setError("Missing panel id in URL. Use /panel?id=<panelId>.");
      return;
    }

    try {
      const result = await postPanelCommand(panelId, {
        action: "UPDATE_RTC_SCHEDULE",
        schedule: {
          startLocalTime: scheduleStart,
          endLocalTime: scheduleEnd,
        },
      });
      setMessage(`Schedule updated: ${result.requestId}`);
      setError(null);
    } catch (commandError) {
      setError(
        commandError instanceof Error
          ? commandError.message
          : "Schedule command failed.",
      );
    }
  };

  // Automated Insights logic
  const insights = [];
  if (status) {
    if (status.avgVoltage < 210) {
      insights.push({
        type: "warning",
        text: `Low Voltage Detected: ${status.avgVoltage.toFixed(1)}V (Under 210V threshold)`,
      });
    } else if (status.avgVoltage > 250) {
      insights.push({
        type: "warning",
        text: `Over Voltage Detected: ${status.avgVoltage.toFixed(1)}V (Over 250V threshold)`,
      });
    } else {
      insights.push({
        type: "ok",
        text: `Grid voltage optimal at ${status.avgVoltage.toFixed(1)}V`,
      });
    }

    if (status.totalPowerFactor < 0.85) {
      insights.push({
        type: "warning",
        text: `Poor Power Factor: ${status.totalPowerFactor.toFixed(2)}. Suggests heavy reactive load.`,
      });
    } else {
      insights.push({
        type: "ok",
        text: `Power factor is stable (${status.totalPowerFactor.toFixed(2)})`,
      });
    }

    if (status.gridFrequency < 49.5 || status.gridFrequency > 50.5) {
      insights.push({
        type: "warning",
        text: `Grid frequency unstable: ${status.gridFrequency.toFixed(2)}Hz`,
      });
    }
  }

  const formatTimeXAxis = (tickItem: string) => {
    try {
      return format(parseISO(tickItem), "HH:mm:ss");
    } catch {
      return tickItem;
    }
  };

  return (
    <section className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <Link
            href="/panels"
            className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors mb-2 font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Fleet
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <Activity className="h-7 w-7 text-emerald-400 animate-pulse" />
              Node Dashboard
            </h2>
            <div className="px-3 py-1 rounded bg-slate-800/80 border border-slate-700 text-sm font-mono text-slate-300 shadow-inner">
              {panelId || "No ID"}
            </div>
            {panelId && (
              <Link
                href={`/manage-panel?id=${panelId}`}
                className="ml-2 px-3 py-1 rounded flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs text-slate-300 transition-colors"
              >
                <Edit className="h-3 w-3" /> Edit Node
              </Link>
            )}
          </div>
        </div>

        {status && (
          <div className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <span className="relative flex h-2 w-2 mr-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            LIVE DATA ACTIVE
          </div>
        )}
      </div>

      {!panelId && (
        <div className="rounded-lg bg-amber-950/30 border border-amber-900/50 p-4 text-amber-400 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" /> Open this page as
          `/panel?id=your-panel-id`.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 p-4 text-rose-400 text-sm flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" /> {error}
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 p-4 text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" /> {message}
        </div>
      )}

      {/* Real-time Insights Panel */}
      {insights.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {insights.map((insight, idx) => (
            <div
              key={idx}
              className={`rounded-xl border p-4 flex gap-3 ${
                insight.type === "warning"
                  ? "bg-amber-950/20 border-amber-900/50"
                  : "bg-emerald-950/10 border-emerald-900/30"
              }`}
            >
              <div className="mt-0.5">
                {insight.type === "warning" ? (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                )}
              </div>
              <p
                className={`text-sm ${insight.type === "warning" ? "text-amber-200/90" : "text-emerald-200/80"}`}
              >
                {insight.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Primary KPI Grid (Current Snapshot) */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
        <StatBox
          label="Phase 1 V"
          value={status ? `${status.phase1Voltage.toFixed(1)} V` : "-"}
        />
        <StatBox
          label="Avg V"
          value={status ? `${status.avgVoltage.toFixed(1)} V` : "-"}
          active={
            status?.avgVoltage !== undefined &&
            (status.avgVoltage > 250 || status.avgVoltage < 210)
          }
        />
        <StatBox
          label="Avg I"
          value={status ? `${status.avgCurrent.toFixed(2)} A` : "-"}
          highlight
        />
        <StatBox
          label="Freq"
          value={status ? `${status.gridFrequency.toFixed(2)} Hz` : "-"}
        />
        <StatBox
          label="Ph1 PF"
          value={status ? `${status.powerFactorPh1.toFixed(3)}` : "-"}
          active={
            status?.powerFactorPh1 !== undefined && status.powerFactorPh1 < 0.85
          }
        />
        <StatBox
          label="Total PF"
          value={status ? `${status.totalPowerFactor.toFixed(3)}` : "-"}
          active={
            status?.totalPowerFactor !== undefined &&
            status.totalPowerFactor < 0.85
          }
        />
        <StatBox
          label="Vector"
          value={status ? `${status.powerVector.toFixed(2)}` : "-"}
        />
      </div>

      <div className="flex justify-end pr-1 -mt-4">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="h-3 w-3" /> Reported:{" "}
          {status?.reportedAtUtc
            ? format(parseISO(status.reportedAtUtc), "PP pp : ss")
            : "Awaiting shadow read"}
        </div>
      </div>

      {/* Live Charts */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-semibold text-lg flex items-center gap-2 text-slate-200">
            <History className="h-5 w-5 text-indigo-400" /> Historical Feed &
            Analytics
          </h3>
          <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-lg border border-slate-800">
            {(["1H", "24H", "7D"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  timeRange === range
                    ? "bg-indigo-500 text-white shadow-lg"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {telemetry.length > 0 ? (
          <>
            <IntervalInsights data={telemetry} />
            <div className="grid gap-4 lg:grid-cols-2 mt-4">
              <LiveChartCard
                title="Instantaneous Voltage"
                data={telemetry}
                dataKey="avgVoltage"
                color="#2dd4bf"
                unit="V"
                domain={[200, 260]}
              />
              <LiveChartCard
                title="Load Current"
                data={telemetry}
                dataKey="avgCurrent"
                color="#a78bfa"
                unit="A"
              />
              <LiveChartCard
                title="Grid Frequency"
                data={telemetry}
                dataKey="gridFrequency"
                color="#38bdf8"
                unit="Hz"
                domain={[49, 51]}
              />
              <LiveChartCard
                title="Power Factor"
                data={telemetry}
                dataKey="totalPowerFactor"
                color="#fb7185"
                unit=""
                domain={[0, 1]}
              />
            </div>
          </>
        ) : (
          <div className="py-12 text-center border border-slate-800 border-dashed rounded-xl bg-slate-900/20 text-slate-500">
            No historical data found for this period.
          </div>
        )}
      </div>

      {/* Control Surface */}
      <div className="grid gap-4 md:grid-cols-2 pt-6 border-t border-slate-800">
        <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-5 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Power className="h-24 w-24 text-slate-400" />
          </div>
          <h3 className="font-bold text-lg text-slate-200 flex items-center gap-2">
            <Zap className="h-5 w-5 text-cyan-400" /> Relay Control
          </h3>
          <p className="mt-1 text-sm text-slate-400 max-w-[80%]">
            Writes to device shadow over secure MQTT connection. Actuation
            usually takes ~2s.
          </p>

          <div className="mt-6 flex items-center gap-3 relative z-10">
            <select
              value={manualState}
              onChange={(event) =>
                setManualState(event.target.value as "ON" | "OFF")
              }
              className="rounded-md border border-slate-600 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500 focus:border-cyan-500 outline-none w-32 shadow-inner"
            >
              <option value="ON">Relay ON</option>
              <option value="OFF">Relay OFF</option>
            </select>
            <button
              type="button"
              onClick={() => void sendManualCommand()}
              className="rounded-md bg-cyan-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
            >
              Dispatch Command
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-5 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Settings2 className="h-24 w-24 text-slate-400" />
          </div>
          <h3 className="font-bold text-lg text-slate-200 flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-400" /> RTC Schedule
          </h3>
          <p className="mt-1 text-sm text-slate-400 max-w-[80%]">
            Set local chron-job configuration. Device will auto-actuate on daily
            intervals.
          </p>

          <div className="mt-6 flex flex-wrap items-end gap-3 relative z-10 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Enable
              </span>
              <input
                type="time"
                value={scheduleStart}
                onChange={(event) => setScheduleStart(event.target.value)}
                className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-slate-200 focus:border-purple-500 outline-none shadow-inner [color-scheme:dark]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Disable
              </span>
              <input
                type="time"
                value={scheduleEnd}
                onChange={(event) => setScheduleEnd(event.target.value)}
                className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-slate-200 focus:border-purple-500 outline-none shadow-inner [color-scheme:dark]"
              />
            </label>
            <button
              type="button"
              onClick={() => void sendScheduleCommand()}
              className="rounded-md bg-purple-500 px-5 py-2 text-sm font-bold text-white hover:bg-purple-400 transition-colors shadow-lg shadow-purple-500/20"
            >
              Sync RTC
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatBox({
  label,
  value,
  highlight,
  active,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  active?: boolean;
}) {
  const bg = active
    ? "bg-rose-950/40 border-rose-800/50"
    : highlight
      ? "bg-cyan-950/20 border-cyan-900/40"
      : "bg-slate-900/60 border-slate-700/60";
  const labelColor = active ? "text-rose-400/80" : "text-slate-400";
  const valColor = active
    ? "text-rose-300 font-bold"
    : highlight
      ? "text-cyan-300 font-bold"
      : "text-slate-100 font-semibold";

  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-300 flex flex-col justify-center ${bg} ${active ? "animate-pulse" : ""}`}
    >
      <p
        className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${labelColor}`}
      >
        {label}
      </p>
      <p className={`text-xl font-mono ${valColor}`}>{value}</p>
    </div>
  );
}

function LiveChartCard({
  title,
  data,
  dataKey,
  color,
  unit,
  domain,
}: {
  title: string;
  data: TelemetryPoint[];
  dataKey: keyof TelemetryPoint;
  color: string;
  unit: string;
  domain?: [number, number];
}) {
  const currentVal =
    data.length > 0 ? (data[data.length - 1] as any)[dataKey] : null;
  const valDisplay =
    currentVal !== null && currentVal !== undefined
      ? Number(currentVal).toFixed(2)
      : "-";

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-4 flex flex-col">
      <div className="flex justify-between items-center mb-4 border-b border-slate-800/60 pb-2">
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold" style={{ color }}>
            {valDisplay}
          </span>
          <span className="text-xs text-slate-500">{unit}</span>
        </div>
      </div>

      <div className="h-40 w-full mt-auto">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              opacity={0.3}
              vertical={false}
            />
            <XAxis
              dataKey="timestampUtc"
              tickFormatter={(t) => {
                try {
                  return format(parseISO(t), "HH:mm:ss");
                } catch {
                  return t;
                }
              }}
              stroke="#64748b"
              fontSize={10}
              minTickGap={20}
            />
            <YAxis
              domain={domain || ["auto", "auto"]}
              stroke="#64748b"
              fontSize={10}
              tickFormatter={(t) => Number(t).toFixed(0)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderColor: "#334155",
                borderRadius: "8px",
                fontSize: "11px",
              }}
              itemStyle={{ color: color, fontWeight: "bold" }}
              labelFormatter={(l) => {
                try {
                  return format(parseISO(l as string), "HH:mm:ss");
                } catch {
                  return l;
                }
              }}
            />
            <Line
              type="monotone"
              isAnimationActive={false}
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                fill: color,
                stroke: "#0f172a",
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function IntervalInsights({ data }: { data: TelemetryPoint[] }) {
  if (!data || data.length === 0) return null;

  const avgVoltage =
    data.reduce((sum, p) => sum + p.avgVoltage, 0) / data.length;
  const avgCurrent =
    data.reduce((sum, p) => sum + p.avgCurrent, 0) / data.length;
  const avgPF =
    data.reduce((sum, p) => sum + p.totalPowerFactor, 0) / data.length;

  const voltages = data.map((p) => p.avgVoltage);
  const maxVoltage = voltages.length > 0 ? Math.max(...voltages) : 0;
  const minVoltage = voltages.length > 0 ? Math.min(...voltages) : 0;

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-5 mt-4">
      <InsightBox
        label="Period Avg Volts"
        value={`${avgVoltage.toFixed(1)} V`}
        icon={<Zap className="h-3 w-3" />}
      />
      <InsightBox
        label="Period Peak Volts"
        value={`${maxVoltage.toFixed(1)} V`}
        color="text-rose-400"
      />
      <InsightBox
        label="Period Min Volts"
        value={`${minVoltage.toFixed(1)} V`}
        color="text-amber-400"
      />
      <InsightBox
        label="Period Avg Amps"
        value={`${avgCurrent.toFixed(2)} A`}
        color="text-cyan-400"
      />
      <InsightBox
        label="Period Avg PF"
        value={`${avgPF.toFixed(3)}`}
        color={avgPF < 0.85 ? "text-rose-400" : "text-emerald-400"}
      />
    </div>
  );
}

function InsightBox({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3 shadow-sm hover:bg-slate-800/60 transition-colors">
      <p className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
        {icon} {label}
      </p>
      <p className={`text-lg font-bold mt-1 ${color || "text-slate-200"}`}>
        {value}
      </p>
    </div>
  );
}
