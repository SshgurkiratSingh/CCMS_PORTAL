"use client";

import { useMemo, useState, useEffect, Fragment } from "react";
import { getPanelTelemetry, getPanels } from "@/lib/api/ccms-api";
import registerMap from "@/lib/register-map.json";
import type {
  TelemetryPoint,
  TelemetryResponse,
  PanelRecord,
} from "@/lib/api/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import {
  Download,
  Table as TableIcon,
  Activity,
  Settings2,
  BarChart2,
} from "lucide-react";

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

  const [panels, setPanels] = useState<PanelRecord[]>([]);
  const [selectedPanelIds, setSelectedPanelIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(toInputDate(lastWeek));
  const [endDate, setEndDate] = useState(toInputDate(now));
  const [results, setResults] = useState<TelemetryResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch available panels to populate the dropdown
    getPanels({ limit: 100 })
      .then((res) => {
        setPanels(res.items);
        if (res.items.length > 0 && selectedPanelIds.length === 0) {
          setSelectedPanelIds([res.items[0].panelId]);
        }
      })
      .catch((err) => {
        console.error("Failed to load panels for analytics:", err);
      });
  }, []);

  const [activeTab, setActiveTab] = useState<TabType>("chart");

  const mergedPoints = useMemo(() => {
    if (results.length === 0) return [];

    // Merge by timestamp
    const pointMap = new Map<string, any>();

    results.forEach((res) => {
      res.points.forEach((pt) => {
        if (!pointMap.has(pt.timestampUtc)) {
          pointMap.set(pt.timestampUtc, { timestampUtc: pt.timestampUtc });
        }
        const bucket = pointMap.get(pt.timestampUtc);

        // Prefix properties with the panelId to render multiple series side-by-side!
        registerMap.registers.forEach((reg) => {
          const key = reg.id as keyof typeof pt;
          if (pt[key] !== undefined) {
            bucket[`${res.panelId}_${reg.id}`] = pt[key];
          }
        });
      });
    });

    return Array.from(pointMap.values()).sort(
      (a, b) =>
        new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime(),
    );
  }, [results]);

  // Custom multi-metric toggles for 'compare' mode
  const [compareMetrics, setCompareMetrics] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      registerMap.registers.forEach((reg) => {
        // default ON for voltage and current
        initial[reg.id] = reg.id === "avgVoltage" || reg.id === "avgCurrent";
      });
      return initial;
    },
  );

  const handlePanelToggle = (pid: string) => {
    setSelectedPanelIds((prev) =>
      prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid],
    );
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedPanelIds.length === 0) {
      setError("Please select at least one Panel Node");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const promises = selectedPanelIds.map((id) =>
        getPanelTelemetry({
          panelId: id.trim(),
          startUtcIso: dateToStartIso(startDate),
          endUtcIso: dateToEndIso(endDate),
        }),
      );

      const fetchResults = await Promise.all(promises);

      // Sort points chronologically just in case
      const sortedResults = fetchResults.map((res) => ({
        ...res,
        points: res.points.sort(
          (a, b) =>
            new Date(a.timestampUtc).getTime() -
            new Date(b.timestampUtc).getTime(),
        ),
      }));

      setResults(sortedResults);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Telemetry query failed.",
      );
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = () => {
    if (results.length === 0) return;

    // Build headers from registerMap
    const validRegisters = registerMap.registers.filter(
      (r) => r.category !== "Control",
    );
    const headers = [
      "Panel ID",
      "Timestamp UTC",
      ...validRegisters.map((r) => r.name),
    ];

    const rows: string[][] = [];
    results.forEach((res) => {
      res.points.forEach((p) => {
        const row = [res.panelId, p.timestampUtc];
        validRegisters.forEach((r) => {
          const val = p[r.id as keyof typeof p];
          row.push(
            typeof val === "number" ? val.toFixed(2) : String(val ?? ""),
          );
        });
        rows.push(row);
      });
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((e) => e.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `telemetry_multinode_${startDate}_to_${endDate}.csv`,
    );
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
          {results.length > 0 && results.some((r) => r.points.length > 0) && (
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

      <form
        onSubmit={onSubmit}
        className="grid gap-4 rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 md:grid-cols-4 shadow-sm"
      >
        <label className="text-sm font-medium">
          <span className="block text-slate-400 mb-1.5">Select Node(s)</span>
          <div className="relative group">
            <div className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 focus-within:border-cyan-500 flex flex-wrap gap-1 min-h-[40px] cursor-pointer">
              {selectedPanelIds.length === 0 && (
                <span className="text-slate-500">Pick panels...</span>
              )}
              {selectedPanelIds.map((pid) => (
                <span
                  key={pid}
                  className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded text-xs flex items-center gap-1 border border-indigo-500/30"
                >
                  {pid}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handlePanelToggle(pid);
                    }}
                    className="hover:text-white"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>

            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-xl hidden group-hover:block max-h-60 overflow-y-auto">
              {panels.map((p) => (
                <label
                  key={p.panelId}
                  className="flex flex-row items-center gap-2 px-3 py-2 hover:bg-slate-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedPanelIds.includes(p.panelId)}
                    onChange={() => handlePanelToggle(p.panelId)}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm text-slate-200">{p.panelId}</span>
                    {p.name && p.name !== p.panelId && (
                      <span className="text-xs text-slate-500">{p.name}</span>
                    )}
                  </div>
                </label>
              ))}
              {panels.length === 0 && (
                <div className="px-3 py-2 text-slate-500 text-sm">
                  Loading nodes...
                </div>
              )}
            </div>
          </div>
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

      {results.length > 0 && !results.some((r) => r.points.length > 0) && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/20 p-8 text-center text-slate-400">
          No telemetry points found for this range.
        </div>
      )}

      {results.length > 0 && results.some((r) => r.points.length > 0) && (
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
              {registerMap.registers
                .filter((r) => r.category !== "Control")
                .map((reg) => (
                  <MultiChartCard
                    key={reg.id}
                    title={`${reg.name} ${reg.unit ? `(${reg.unit})` : ""}`}
                    data={mergedPoints}
                    metricKey={reg.id}
                    panels={results.map((r) => r.panelId)}
                    domain={
                      reg.id.includes("Voltage")
                        ? [200, 260]
                        : reg.id.includes("Frequency")
                          ? [48, 52]
                          : reg.id.includes("PowerFactor")
                            ? [0, 1.1]
                            : ["auto", "auto"]
                    }
                  />
                ))}
            </div>
          )}

          {/* Compare Tab */}
          {activeTab === "compare" && (
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
              <div className="mb-6 flex flex-wrap gap-4 rounded-lg bg-slate-950/50 p-4 border border-slate-800">
                <p className="w-full text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Toggle Metrics overlay
                </p>
                {registerMap.registers
                  .filter((r) => r.category !== "Control")
                  .map((reg) => (
                    <Toggle
                      key={reg.id}
                      label={reg.name}
                      checked={!!compareMetrics[reg.id]}
                      onChange={(c) =>
                        setCompareMetrics((p) => ({ ...p, [reg.id]: c }))
                      }
                      color={`bg-[${reg.chartColor}]`}
                    />
                  ))}
              </div>

              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={mergedPoints}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#334155"
                      opacity={0.5}
                    />
                    <XAxis
                      dataKey="timestampUtc"
                      tickFormatter={formatTimeXAxis}
                      stroke="#94a3b8"
                      fontSize={12}
                      minTickGap={50}
                    />
                    <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#94a3b8"
                      fontSize={12}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ color: "#e2e8f0" }}
                      labelFormatter={(l) => {
                        try {
                          return format(parseISO(l as string), "PP pp");
                        } catch {
                          return l;
                        }
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: "20px" }} />
                    {results.map((res, idx) => (
                      <Fragment key={res.panelId}>
                        {registerMap.registers
                          .filter((r) => r.category !== "Control")
                          .map(
                            (reg, regIdx) =>
                              compareMetrics[reg.id] && (
                                <Line
                                  key={`${res.panelId}_${reg.id}`}
                                  yAxisId={
                                    reg.name.includes("Factor") ||
                                    reg.name.includes("Frequency")
                                      ? "right"
                                      : "left"
                                  }
                                  type="monotone"
                                  dataKey={`${res.panelId}_${reg.id}`}
                                  name={`${res.panelId} ${reg.name}`}
                                  stroke={
                                    reg.chartColor ||
                                    CHART_COLORS[
                                      (idx + regIdx) % CHART_COLORS.length
                                    ]
                                  }
                                  strokeDasharray={
                                    idx === 0
                                      ? ""
                                      : idx === 1
                                        ? "5 5"
                                        : idx === 2
                                          ? "3 3"
                                          : "4 1 2"
                                  }
                                  dot={false}
                                  strokeWidth={2}
                                  connectNulls
                                />
                              ),
                          )}
                      </Fragment>
                    ))}
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
                    <th className="px-4 py-3 whitespace-nowrap">Panel ID</th>
                    <th className="px-4 py-3 whitespace-nowrap">
                      Timestamp (UTC)
                    </th>
                    {registerMap.registers
                      .filter((r) => r.category !== "Control")
                      .map((reg) => (
                        <th
                          key={reg.id}
                          className="px-4 py-3 text-right whitespace-nowrap"
                        >
                          {reg.name} {reg.unit ? `(${reg.unit})` : ""}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950/30">
                  {results.map((res) =>
                    res.points.map((point) => (
                      <tr
                        key={`${res.panelId}_${point.timestampUtc}`}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-4 py-2 font-mono text-slate-400 text-xs">
                          {res.panelId}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-slate-400">
                          {format(
                            parseISO(point.timestampUtc),
                            "yyyy-MM-dd HH:mm:ss",
                          )}
                        </td>
                        {registerMap.registers
                          .filter((r) => r.category !== "Control")
                          .map((reg) => {
                            const val = point[reg.id as keyof typeof point];
                            return (
                              <td
                                key={reg.id}
                                className="px-4 py-2 text-right font-mono"
                              >
                                {typeof val === "number"
                                  ? val.toFixed(
                                      reg.id.includes("Factor") ? 3 : 2,
                                    )
                                  : String(val ?? "-")}
                              </td>
                            );
                          })}
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function TabButton({
  children,
  active,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
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

const CHART_COLORS = [
  "#2dd4bf",
  "#a78bfa",
  "#38bdf8",
  "#fb7185",
  "#facc15",
  "#10b981",
  "#ff7c43",
  "#82ca9d",
];

function MultiChartCard({
  title,
  data,
  metricKey,
  panels,
  domain,
}: {
  title: string;
  data: any[];
  metricKey: string;
  panels: string[];
  domain?: [number | "auto", number | "auto"];
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
      <h3 className="mb-4 text-sm font-medium text-slate-300">{title}</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              opacity={0.5}
              vertical={false}
            />
            <XAxis
              dataKey="timestampUtc"
              tickFormatter={(t) => {
                try {
                  return format(parseISO(t), "HH:mm");
                } catch {
                  return t;
                }
              }}
              stroke="#64748b"
              fontSize={11}
              minTickGap={30}
            />
            <YAxis
              domain={domain || ["auto", "auto"]}
              stroke="#64748b"
              fontSize={11}
              width={45}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderColor: "#334155",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              itemStyle={{ color: "#e2e8f0" }}
              labelFormatter={(l) => {
                try {
                  return format(parseISO(l as string), "PP pp");
                } catch {
                  return l;
                }
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
            {panels.map((panelId, idx) => (
              <Line
                key={panelId}
                type="monotone"
                dataKey={`${panelId}_${metricKey}`}
                name={panelId}
                stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  color,
}: {
  label: string;
  checked: boolean;
  onChange: (c: boolean) => void;
  color: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? color : "bg-slate-700"}`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`}
        />
      </div>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm font-medium text-slate-300">{label}</span>
    </label>
  );
}
