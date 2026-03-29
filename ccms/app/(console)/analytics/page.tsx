"use client";

import { useMemo, useState } from "react";
import { getPanelTelemetry } from "@/lib/api/ccms-api";
import type { TelemetryPoint, TelemetryResponse } from "@/lib/api/types";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { format, parseISO } from "date-fns";
import { Download, Table as TableIcon, Activity, Settings2, BarChart2 } from "lucide-react";

function toInputDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateToStartIso(dateValue: string): string {
  return new Date(`${dateValue}T00:00:00.000Z`).toISOString();
}

function dateToEndIso(dateValue: string): string {
  return new Date(`${dateValue}T23:59:59.999Z`).toISOString();
}

type TabType = "chart" | "data" | "compare";

export default function AnalyticsPage() {
  const now = useMemo(() => new Date(), []);
  const lastWeek = useMemo(() => {
    const copy = new Date(now);
    copy.setUTCDate(copy.getUTCDate() - 7);
    return copy;
  }, [now]);

  const [panelId, setPanelId] = useState("");
  const [startDate, setStartDate] = useState(toInputDate(lastWeek));
  const [endDate, setEndDate] = useState(toInputDate(now));
  const [result, setResult] = useState<TelemetryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>("chart");

  // Custom multi-metric toggles for 'compare' mode
  const [compareMetrics, setCompareMetrics] = useState({
    avgVoltage: true,
    avgCurrent: true,
    gridFrequency: false,
    totalPowerFactor: false,
  });

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await getPanelTelemetry({
        panelId: panelId.trim(),
        startUtcIso: dateToStartIso(startDate),
        endUtcIso: dateToEndIso(endDate),
      });
      // Sort points chronologically just in case
      const sorted = {
        ...response,
        points: response.points.sort(
          (a, b) => new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime()
        ),
      };
      setResult(sorted);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Telemetry query failed."
      );
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!result || result.points.length === 0) return;

    const headers = ["Timestamp UTC", "Ph1 V", "Avg V", "Avg I", "Freq Hz", "Ph1 PF", "Total PF", "Power Vector"];
    const rows = result.points.map((p) => [
      p.timestampUtc,
      p.phase1Voltage.toFixed(2),
      p.avgVoltage.toFixed(2),
      p.avgCurrent.toFixed(3),
      p.gridFrequency.toFixed(2),
      p.powerFactorPh1.toFixed(3),
      p.totalPowerFactor.toFixed(3),
      p.powerVector.toFixed(2)
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `telemetry_${result.panelId}_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Recharts specific formatter
  const formatTimeXAxis = (tickItem: string) => {
    try {
      return format(parseISO(tickItem), "MMM dd, HH:mm");
    } catch {
      return tickItem;
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 border-b border-slate-800 pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-100 flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-indigo-400" />
            Telemetry Analytics
          </h2>
          {result && result.points.length > 0 && (
            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-2 rounded bg-indigo-500/10 px-3 py-1.5 text-sm font-medium text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200 transition-colors border border-indigo-500/20"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          )}
        </div>
        <p className="text-sm text-slate-400">
          Query historical sensor data, generate plots, and export metrics.
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 md:grid-cols-4 shadow-sm">
        <label className="text-sm font-medium">
          <span className="block text-slate-400 mb-1.5">Panel ID</span>
          <input
            required
            placeholder="e.g. PN-001"
            value={panelId}
            onChange={(event) => setPanelId(event.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
          />
        </label>

        <label className="text-sm font-medium">
          <span className="block text-slate-400 mb-1.5">Start Date (UTC)</span>
          <input
            required
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all [color-scheme:dark]"
          />
        </label>

        <label className="text-sm font-medium">
          <span className="block text-slate-400 mb-1.5">End Date (UTC)</span>
          <input
            required
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all [color-scheme:dark]"
          />
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-indigo-400 transition-colors shadow-lg shadow-indigo-500/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Activity className="h-4 w-4 animate-spin" /> Querying...
              </span>
            ) : (
              "Run Query"
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 p-4 text-rose-400">
          {error}
        </div>
      )}

      {result && result.points.length === 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/20 p-8 text-center text-slate-400">
          No telemetry points found for this range.
        </div>
      )}

      {result && result.points.length > 0 && (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-slate-800 pb-px">
            <TabButton 
              active={activeTab === "chart"} 
              onClick={() => setActiveTab("chart")}
              icon={<Activity className="h-4 w-4" />}
            >
              Overview Chart
            </TabButton>
            <TabButton 
              active={activeTab === "compare"} 
              onClick={() => setActiveTab("compare")}
              icon={<Settings2 className="h-4 w-4" />}
            >
              Custom Compare
            </TabButton>
            <TabButton 
              active={activeTab === "data"} 
              onClick={() => setActiveTab("data")}
              icon={<TableIcon className="h-4 w-4" />}
            >
              Raw Data
            </TabButton>
          </div>

          {/* Chart Tab */}
          {activeTab === "chart" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Voltage Over Time (V)" data={result.points} dataKey="avgVoltage" color="#2dd4bf" domain={[200, 260]} />
              <ChartCard title="Current Over Time (A)" data={result.points} dataKey="avgCurrent" color="#a78bfa" />
              <ChartCard title="Grid Frequency (Hz)" data={result.points} dataKey="gridFrequency" color="#38bdf8" domain={[48, 52]} />
              <ChartCard title="Power Factor" data={result.points} dataKey="totalPowerFactor" color="#fb7185" domain={[0, 1]} />
            </div>
          )}

          {/* Compare Tab */}
          {activeTab === "compare" && (
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
              <div className="mb-6 flex flex-wrap gap-4 rounded-lg bg-slate-950/50 p-4 border border-slate-800">
                <p className="w-full text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Toggle Metrics overlay</p>
                <Toggle label="Avg Voltage" checked={compareMetrics.avgVoltage} 
                  onChange={(c) => setCompareMetrics(p => ({...p, avgVoltage: c}))} color="bg-teal-400" />
                <Toggle label="Avg Current" checked={compareMetrics.avgCurrent} 
                  onChange={(c) => setCompareMetrics(p => ({...p, avgCurrent: c}))} color="bg-violet-400" />
                <Toggle label="Frequency" checked={compareMetrics.gridFrequency} 
                  onChange={(c) => setCompareMetrics(p => ({...p, gridFrequency: c}))} color="bg-sky-400" />
                <Toggle label="Power Factor" checked={compareMetrics.totalPowerFactor} 
                  onChange={(c) => setCompareMetrics(p => ({...p, totalPowerFactor: c}))} color="bg-rose-400" />
              </div>
              
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.points} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis 
                      dataKey="timestampUtc" 
                      tickFormatter={formatTimeXAxis}
                      stroke="#94a3b8" 
                      fontSize={12} 
                      minTickGap={50}
                    />
                    <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px" }}
                      itemStyle={{ color: "#e2e8f0" }}
                      labelFormatter={(l) => format(parseISO(l as string), "PP pp")}
                    />
                    <Legend wrapperStyle={{ paddingTop: "20px" }} />
                    {compareMetrics.avgVoltage && <Line yAxisId="left" type="monotone" dataKey="avgVoltage" name="Avg Voltage (V)" stroke="#2dd4bf" dot={false} strokeWidth={2} />}
                    {compareMetrics.avgCurrent && <Line yAxisId="left" type="monotone" dataKey="avgCurrent" name="Avg Current (A)" stroke="#a78bfa" dot={false} strokeWidth={2} />}
                    {compareMetrics.gridFrequency && <Line yAxisId="right" type="monotone" dataKey="gridFrequency" name="Frequency (Hz)" stroke="#38bdf8" dot={false} strokeWidth={2} />}
                    {compareMetrics.totalPowerFactor && <Line yAxisId="right" type="monotone" dataKey="totalPowerFactor" name="Power Factor" stroke="#fb7185" dot={false} strokeWidth={2} />}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Raw Data Tab */}
          {activeTab === "data" && (
            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="min-w-full text-sm text-slate-300">
                <thead className="bg-slate-900/80 text-left text-slate-400 font-medium">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">Timestamp (UTC)</th>
                    <th className="px-4 py-3 text-right">Ph1 V</th>
                    <th className="px-4 py-3 text-right">Avg V</th>
                    <th className="px-4 py-3 text-right">Avg I</th>
                    <th className="px-4 py-3 text-right">Freq Hz</th>
                    <th className="px-4 py-3 text-right">Total PF</th>
                    <th className="px-4 py-3 text-right">Power Vector</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950/30">
                  {result.points.map((point) => (
                    <tr key={point.timestampUtc} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2 whitespace-nowrap text-slate-400">{format(parseISO(point.timestampUtc), "yyyy-MM-dd HH:mm:ss")}</td>
                      <td className="px-4 py-2 text-right font-mono">{point.phase1Voltage.toFixed(1)}</td>
                      <td className="px-4 py-2 text-right font-mono">{point.avgVoltage.toFixed(1)}</td>
                      <td className="px-4 py-2 text-right font-mono">{point.avgCurrent.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-mono">{point.gridFrequency.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-mono">{point.totalPowerFactor.toFixed(3)}</td>
                      <td className="px-4 py-2 text-right font-mono">{point.powerVector.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function TabButton({ children, active, onClick, icon }: { children: React.ReactNode, active: boolean, onClick: () => void, icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
        active 
          ? "border-indigo-400 text-indigo-300 bg-indigo-500/5" 
          : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function ChartCard({ title, data, dataKey, color, domain }: { title: string, data: TelemetryPoint[], dataKey: keyof TelemetryPoint, color: string, domain?: [number, number] }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
      <h3 className="mb-4 text-sm font-medium text-slate-300">{title}</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
            <XAxis 
              dataKey="timestampUtc" 
              tickFormatter={(t) => {
                try { return format(parseISO(t), "HH:mm"); } catch { return t; }
              }} 
              stroke="#64748b" 
              fontSize={11} 
              minTickGap={30}
            />
            <YAxis 
              domain={domain || ['auto', 'auto']} 
              stroke="#64748b" 
              fontSize={11}
              width={45}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
              itemStyle={{ color: color }}
              labelFormatter={(l) => {
                try { return format(parseISO(l as string), "PP pp"); } catch { return l; }
              }}
            />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange, color }: { label: string, checked: boolean, onChange: (c: boolean) => void, color: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div 
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? color : 'bg-slate-700'}`}
      >
        <span 
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`}
        />
      </div>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm font-medium text-slate-300">{label}</span>
    </label>
  );
}
