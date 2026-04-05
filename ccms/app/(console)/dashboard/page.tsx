"use client";

import { useEffect, useState } from "react";
import { getDashboardSummary, getPanels, getAlerts } from "@/lib/api/ccms-api";
import type { DashboardSummary, PanelRecord, AlertRecord } from "@/lib/api/types";
import {
  Activity,
  AlertTriangle,
  Settings2,
  Zap,
  Radio,
  ServerCrash,
  BarChart3,
  ListRestart,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  PageHeader,
  SectionCard,
  CardHeader,
  PanelStatusChip,
  SeverityChip,
  FaultCodeTag,
  ErrorBanner,
  LoadingRow,
} from "@/components/ui";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [panels, setPanels] = useState<PanelRecord[] | null>(null);
  const [alerts, setAlerts] = useState<AlertRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [nextSummary, nextPanels, nextAlerts] = await Promise.all([
          getDashboardSummary(),
          getPanels({ limit: 12 }),
          getAlerts(),
        ]);
        if (mounted) {
          setSummary(nextSummary);
          setPanels(nextPanels.items);
          setAlerts(nextAlerts.items);
          setError(null);
        }
      } catch (loadError) {
        if (mounted)
          setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard data.");
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  if (!summary && !error) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Activity className="h-8 w-8 animate-pulse text-cyan-400" />
          <p className="animate-pulse text-slate-300">Initializing Fleet Summary...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <SectionCard className="p-6 text-center border-rose-900/50 bg-rose-950/20">
        <ServerCrash className="mx-auto mb-4 h-10 w-10 text-rose-500" />
        <p className="font-semibold text-rose-400">System Error</p>
        <p className="mt-1 text-sm text-rose-300/80">{error}</p>
      </SectionCard>
    );
  }

  const isPfLow = summary?.gridTotalPf !== undefined && summary.gridTotalPf < 0.85;
  const isVoltageLow = summary?.gridAvgVoltage !== undefined && summary.gridAvgVoltage < 210;
  const isVoltageHigh = summary?.gridAvgVoltage !== undefined && summary.gridAvgVoltage > 250;

  return (
    <section className="space-y-6">
      <PageHeader
        icon={<Radio className="h-6 w-6 text-cyan-400" />}
        title="Global Command Center"
        description="Real-time cluster telemetry and grid statistics. Aggregated data synced from edge nodes."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Total Nodes"
          value={String(summary?.totalPanels ?? 0)}
          icon={<Settings2 className="h-5 w-5 text-cyan-400" />}
          gradient="from-cyan-500/10 to-transparent"
        />
        <MetricCard
          title="Active Alarms"
          value={String(summary?.activeAlarms ?? 0)}
          icon={
            <AlertTriangle
              className={`h-5 w-5 ${(summary?.activeAlarms ?? 0) > 0 ? "text-amber-400 animate-pulse" : "text-slate-500"}`}
            />
          }
          gradient={(summary?.activeAlarms ?? 0) > 0 ? "from-amber-500/10 to-transparent" : "from-slate-800/50 to-transparent"}
          valueColor={(summary?.activeAlarms ?? 0) > 0 ? "text-amber-400" : "text-slate-300"}
        />
        <MetricCard
          title="Cluster Avg Voltage"
          value={summary?.gridAvgVoltage !== undefined ? `${summary.gridAvgVoltage.toFixed(1)} V` : "Offline"}
          icon={<Zap className={`h-5 w-5 ${isVoltageLow || isVoltageHigh ? "text-rose-400" : "text-emerald-400"}`} />}
          gradient={isVoltageLow || isVoltageHigh ? "from-rose-500/10 to-transparent" : "from-emerald-500/10 to-transparent"}
          valueColor={isVoltageLow || isVoltageHigh ? "text-rose-400" : "text-emerald-400"}
        />
        <MetricCard
          title="Grid Frequency"
          value={summary?.gridFrequency !== undefined ? `${summary.gridFrequency.toFixed(2)} Hz` : "Offline"}
          icon={<Activity className="h-5 w-5 text-indigo-400" />}
          gradient="from-indigo-500/10 to-transparent"
          valueColor="text-indigo-400"
        />
        <MetricCard
          title="Total Power Factor"
          value={summary?.gridTotalPf !== undefined ? summary.gridTotalPf.toFixed(3) : "Offline"}
          icon={<Activity className={`h-5 w-5 ${isPfLow ? "text-rose-400" : "text-emerald-400"}`} />}
          gradient={isPfLow ? "from-rose-500/10 to-transparent" : "from-emerald-500/10 to-transparent"}
          valueColor={isPfLow ? "text-rose-400" : "text-emerald-400"}
        />
        <MetricCard
          title="System Energy (24h)"
          value={`${summary?.energyLast24hKwh ?? 0} kWh`}
          icon={<Zap className="h-5 w-5 text-fuchsia-400" />}
          gradient="from-fuchsia-500/10 to-transparent"
          valueColor="text-fuchsia-400"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard className="p-5 lg:col-span-2">
          <CardHeader icon={<BarChart3 className="h-5 w-5 text-indigo-400" />} title="Fleet Health Overview" />
          <div className="h-64">
            {panels && panels.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: "ONLINE", count: panels.filter((p) => p.status === "ONLINE").length, color: "#10b981" },
                    { name: "OFFLINE", count: panels.filter((p) => p.status === "OFFLINE").length, color: "#64748b" },
                    { name: "FAULT", count: panels.filter((p) => p.status === "FAULT").length, color: "#ef4444" },
                  ]}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "#1e293b" }}
                    contentStyle={{ backgroundColor: "#060d1f", borderColor: "#1e293b", color: "#f1f5f9" }}
                    itemStyle={{ color: "#e2e8f0" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {[{ color: "#10b981" }, { color: "#64748b" }, { color: "#ef4444" }].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500 text-sm">No nodes available</div>
            )}
          </div>
        </SectionCard>

        <SectionCard className="p-5">
          <CardHeader icon={<ListRestart className="h-5 w-5 text-amber-400" />} title="Recent Alerts" />
          <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: "16rem" }}>
            {!alerts || alerts.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-center text-sm text-slate-500">
                No active alerts detected.<br />System is operating normally.
              </div>
            ) : (
              alerts.slice(0, 7).map((alert) => (
                <div
                  key={alert.alertId}
                  className="flex flex-col gap-1.5 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{alert.panelId}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(alert.raisedAtUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityChip severity={alert.severity} />
                    <FaultCodeTag code={alert.faultCode} />
                    <span className="text-slate-400 text-xs">{alert.message}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <div className="flex items-center justify-between border-t border-slate-800/60 px-1 pt-4 text-xs text-slate-500">
        <p>System Status: <span className="font-medium text-emerald-400/80">Operational</span></p>
        <p>Last Sync UTC: {summary?.generatedAtUtc ?? "—"}</p>
      </div>
    </section>
  );
}

function MetricCard({
  title, value, icon, gradient, valueColor = "text-slate-100",
}: {
  title: string; value: string; icon: React.ReactNode; gradient: string; valueColor?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-700/60 bg-gradient-to-br ${gradient} p-5 backdrop-blur-sm transition-all hover:border-slate-600/80`}>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
        <div className="rounded-md bg-slate-900/50 p-2 shadow-inner">{icon}</div>
      </div>
      <p className={`text-3xl font-bold tracking-tight ${valueColor}`}>{value}</p>
    </div>
  );
}
