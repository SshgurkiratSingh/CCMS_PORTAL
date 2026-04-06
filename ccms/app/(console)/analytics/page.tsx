"use client";

import { useMemo, useState, useEffect, Fragment } from "react";
import { getPanelTelemetry, getPanels } from "@/lib/api/ccms-api";
import registerMap from "@/lib/register-map.json";
import type { TelemetryResponse, PanelRecord } from "@/lib/api/types";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
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
  SlidersHorizontal,
} from "lucide-react";
import { Button, Card, Input } from "@heroui/react";
import { ErrorBanner } from "@/components/ui";

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

type TabType = "chart" | "data" | "compare" | "custom";
type CustomChartType = "line" | "area" | "bar";

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
  const [customChartType, setCustomChartType] = useState<CustomChartType>("line");
  const [customPanelId, setCustomPanelId] = useState<string>("");
  const [customMetrics, setCustomMetrics] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      registerMap.registers
        .filter((r) => r.category !== "Control")
        .forEach((reg) => {
          initial[reg.id] = reg.id === "avgVoltage" || reg.id === "avgCurrent";
        });
      return initial;
    },
  );

  const mergedPoints = useMemo(() => {
    if (results.length === 0) return [];

    const pointMap = new Map<string, Record<string, string | number>>();

    results.forEach((res) => {
      res.points.forEach((pt) => {
        if (!pointMap.has(pt.timestampUtc)) {
          pointMap.set(pt.timestampUtc, { timestampUtc: pt.timestampUtc });
        }
        const bucket = pointMap.get(pt.timestampUtc);
        if (!bucket) return;

        registerMap.registers.forEach((reg) => {
          const key = reg.id as keyof typeof pt;
          if (pt[key] !== undefined) {
            bucket[`${res.panelId}_${reg.id}`] = pt[key] as number;
          }
        });
      });
    });

    return Array.from(pointMap.values()).sort(
      (a, b) =>
        new Date(String(a.timestampUtc)).getTime() -
        new Date(String(b.timestampUtc)).getTime(),
    );
  }, [results]);

  const [compareMetrics, setCompareMetrics] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      registerMap.registers.forEach((reg) => {
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

  useEffect(() => {
    if (!customPanelId && selectedPanelIds.length > 0) {
      setCustomPanelId(selectedPanelIds[0]);
    }
  }, [customPanelId, selectedPanelIds]);

  const customPanelTelemetry = useMemo(() => {
    const target = results.find((r) => r.panelId === customPanelId);
    return target?.points ?? [];
  }, [results, customPanelId]);

  const selectedCustomMetricDefs = useMemo(
    () =>
      registerMap.registers.filter(
        (reg) => reg.category !== "Control" && customMetrics[reg.id],
      ),
    [customMetrics],
  );

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
      ...rows.map((entry) => entry.join(",")),
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
            <Button
              variant="secondary"
              onPress={handleDownloadCsv}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>
        <p className="text-sm text-slate-400">
          Query historical sensor data, generate plots, and export metrics.
        </p>
      </div>

      <Card>
        <form
          onSubmit={onSubmit}
          className="grid gap-4 rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 md:grid-cols-4 shadow-sm"
        >
          <label className="text-sm font-medium">
            <span className="block text-slate-400 mb-1.5">Select Node(s)</span>
            <div className="relative group">
              <div className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 focus-within:border-cyan-500 flex flex-wrap gap-1 min-h-10 cursor-pointer">
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
                      <span className="text-sm text-slate-200">
                        {p.panelId}
                      </span>
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
            <span className="block text-slate-400 mb-1.5">
              Start Date (UTC)
            </span>
            <Input
              required
              type="date"
              variant="secondary"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>

          <label className="text-sm font-medium">
            <span className="block text-slate-400 mb-1.5">End Date (UTC)</span>
            <Input
              required
              type="date"
              variant="secondary"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>

          <div className="flex items-end">
            <Button
              type="submit"
              variant="primary"
              isDisabled={loading}
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Activity className="h-4 w-4 animate-spin" /> Querying...
                </span>
              ) : (
                "Run Query"
              )}
            </Button>
          </div>
        </form>
      </Card>

      {error && <ErrorBanner message={error} />}

      {results.length > 0 && !results.some((r) => r.points.length > 0) && (
        <Card className="rounded-lg border border-slate-800 bg-slate-900/20 p-8 text-center text-slate-400">
          No telemetry points found for this range.
        </Card>
      )}

      {results.length > 0 && results.some((r) => r.points.length > 0) && (
        <div className="space-y-4">
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
            <TabButton
              active={activeTab === "custom"}
              onClick={() => setActiveTab("custom")}
              icon={<SlidersHorizontal className="h-4 w-4" />}
            >
              Custom Graph
            </TabButton>
          </div>

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

          {activeTab === "compare" && (
            <Card className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
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
                      onChange={(checked) =>
                        setCompareMetrics((prev) => ({
                          ...prev,
                          [reg.id]: checked,
                        }))
                      }
                      color={`bg-[${reg.chartColor}]`}
                    />
                  ))}
              </div>

              <div className="h-100 w-full">
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
                      labelFormatter={(label) => {
                        try {
                          return format(parseISO(label as string), "PP pp");
                        } catch {
                          return label;
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
            </Card>
          )}

          {activeTab === "data" && (
            <Card className="overflow-x-auto rounded-xl border border-slate-700">
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
            </Card>
          )}

          {activeTab === "custom" && (
            <Card className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <label className="text-sm font-medium lg:col-span-1">
                  <span className="block text-slate-400 mb-1.5">Panel</span>
                  <select
                    value={customPanelId}
                    onChange={(e) => setCustomPanelId(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
                  >
                    {results.map((res) => (
                      <option key={res.panelId} value={res.panelId}>
                        {res.panelId}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="lg:col-span-2">
                  <span className="block text-sm text-slate-400 mb-1.5">Chart Type</span>
                  <div className="flex flex-wrap gap-2">
                    {(["line", "area", "bar"] as const).map((type) => (
                      <Button
                        key={type}
                        size="sm"
                        variant={customChartType === type ? "primary" : "secondary"}
                        onPress={() => setCustomChartType(type)}
                        className="capitalize"
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Select Metrics
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {registerMap.registers
                    .filter((r) => r.category !== "Control")
                    .map((reg) => (
                      <Toggle
                        key={reg.id}
                        label={reg.name}
                        checked={!!customMetrics[reg.id]}
                        onChange={(checked) =>
                          setCustomMetrics((prev) => ({ ...prev, [reg.id]: checked }))
                        }
                        color={`bg-[${reg.chartColor}]`}
                      />
                    ))}
                </div>
              </div>

              {customPanelTelemetry.length === 0 || selectedCustomMetricDefs.length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-8 text-center text-slate-400 text-sm">
                  {customPanelTelemetry.length === 0
                    ? "No telemetry points for selected panel. Run query or pick another panel."
                    : "Select at least one metric to plot."}
                </div>
              ) : (
                <div className="h-105 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {customChartType === "line" ? (
                      <LineChart data={customPanelTelemetry} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                        <XAxis
                          dataKey="timestampUtc"
                          tickFormatter={formatTimeXAxis}
                          stroke="#94a3b8"
                          fontSize={12}
                          minTickGap={50}
                        />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px" }}
                          itemStyle={{ color: "#e2e8f0" }}
                        />
                        <Legend />
                        {selectedCustomMetricDefs.map((reg) => (
                          <Line
                            key={reg.id}
                            type="monotone"
                            dataKey={reg.id}
                            name={reg.name}
                            stroke={reg.chartColor}
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    ) : customChartType === "area" ? (
                      <AreaChart data={customPanelTelemetry} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                        <XAxis
                          dataKey="timestampUtc"
                          tickFormatter={formatTimeXAxis}
                          stroke="#94a3b8"
                          fontSize={12}
                          minTickGap={50}
                        />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px" }}
                          itemStyle={{ color: "#e2e8f0" }}
                        />
                        <Legend />
                        {selectedCustomMetricDefs.map((reg) => (
                          <Area
                            key={reg.id}
                            type="monotone"
                            dataKey={reg.id}
                            name={reg.name}
                            stroke={reg.chartColor}
                            fill={reg.chartColor}
                            fillOpacity={0.18}
                            connectNulls
                          />
                        ))}
                      </AreaChart>
                    ) : (
                      <BarChart data={customPanelTelemetry} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                        <XAxis
                          dataKey="timestampUtc"
                          tickFormatter={formatTimeXAxis}
                          stroke="#94a3b8"
                          fontSize={12}
                          minTickGap={50}
                        />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px" }}
                          itemStyle={{ color: "#e2e8f0" }}
                        />
                        <Legend />
                        {selectedCustomMetricDefs.map((reg) => (
                          <Bar
                            key={reg.id}
                            dataKey={reg.id}
                            name={reg.name}
                            fill={reg.chartColor}
                            radius={[3, 3, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
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
    <Button
      size="sm"
      variant={active ? "secondary" : "ghost"}
      onPress={onClick}
      className="flex items-center gap-2 text-sm font-medium"
    >
      {icon}
      {children}
    </Button>
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
  data: Array<Record<string, string | number>>;
  metricKey: string;
  panels: string[];
  domain?: [number | "auto", number | "auto"];
}) {
  return (
    <Card className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
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
              tickFormatter={(tick) => {
                try {
                  return format(parseISO(String(tick)), "HH:mm");
                } catch {
                  return String(tick);
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
              labelFormatter={(label) => {
                try {
                  return format(parseISO(label as string), "PP pp");
                } catch {
                  return label;
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
    </Card>
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
  onChange: (checked: boolean) => void;
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
