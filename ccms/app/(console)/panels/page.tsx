"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getPanels } from "@/lib/api/ccms-api";
import type { PanelRecord, PanelState } from "@/lib/api/types";
import {
  Search,
  MapPin,
  Activity,
  Radio,
  AlertTriangle,
  Filter,
  ChevronLeft,
  ChevronRight,
  HardDrive,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

const statuses: Array<PanelState | "ALL"> = [
  "ALL",
  "ONLINE",
  "OFFLINE",
  "FAULT",
  "UNKNOWN",
];

type SortKey = "panelId" | "status" | "firmwareVersion" | "lastSeenUtc";

export default function PanelsPage() {
  const [rows, setRows] = useState<PanelRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<PanelState | "ALL">("ALL");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("panelId");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const response = await getPanels({
          status: status === "ALL" ? undefined : status,
          limit,
          offset,
        });

        if (mounted) {
          setRows(response.items);
          setTotal(response.total);
          setError(null);
        }
      } catch (loadError) {
        if (mounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to fetch panel roster.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [limit, offset, status]);

  const filteredAndSorted = useMemo(() => {
    let next = [...rows];

    // Apply client-side search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      next = next.filter(
        (p) =>
          p.panelId.toLowerCase().includes(q) ||
          p.macAddress.toLowerCase().includes(q) ||
          p.firmwareVersion.toLowerCase().includes(q),
      );
    }

    // Sort
    next.sort((a, b) => {
      if (sortKey === "lastSeenUtc") {
        return (
          new Date(b.lastSeenUtc).getTime() - new Date(a.lastSeenUtc).getTime()
        );
      }
      const left = String(a[sortKey]);
      const right = String(b[sortKey]);
      return left.localeCompare(right);
    });
    return next;
  }, [rows, sortKey, searchQuery]);

  // View toggle
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  function getStatusStyle(state: PanelState) {
    switch (state) {
      case "ONLINE":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "OFFLINE":
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
      case "FAULT":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse";
      default:
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
  }

  function getStatusIcon(state: PanelState) {
    switch (state) {
      case "ONLINE":
        return <Activity className="h-3.5 w-3.5" />;
      case "FAULT":
        return <AlertTriangle className="h-3.5 w-3.5" />;
      case "OFFLINE":
        return <Radio className="h-3.5 w-3.5 opacity-50" />;
      default:
        return <Search className="h-3.5 w-3.5" />;
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-100 flex items-center gap-2">
            <HardDrive className="h-6 w-6 text-cyan-400" />
            Fleet Ecosystem
          </h2>
          <p className="text-sm text-slate-400">
            Monitor and manage edge network distribution nodes.
          </p>
        </div>
        <Link
          href="/manage-panel"
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-md shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
        >
          <Activity className="h-4 w-4" /> Add New Node
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search ID, MAC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-64 rounded-md border border-slate-700 bg-slate-950 text-sm text-slate-200 focus:border-cyan-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Filter className="h-4 w-4 text-slate-500" />
            <select
              value={status}
              onChange={(event) => {
                setOffset(0);
                setStatus(event.target.value as PanelState | "ALL");
              }}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-cyan-500"
            >
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item === "ALL" ? "All Statuses" : item}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-sm border-l border-slate-800 pl-4">
            <span className="text-slate-500">Sort</span>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-cyan-500"
            >
              <option value="lastSeenUtc">Latest Activity</option>
              <option value="panelId">Panel ID</option>
              <option value="status">Health State</option>
            </select>
          </div>
        </div>

        <div className="flex rounded-lg border border-slate-700 bg-slate-950 p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3 py-1 text-sm font-medium rounded ${viewMode === "grid" ? "bg-slate-800 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-1 text-sm font-medium rounded ${viewMode === "table" ? "bg-slate-800 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
          >
            Table
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 p-4 text-rose-400 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Activity className="h-4 w-4 animate-spin" /> Fetching latest
          topology...
        </div>
      )}

      {!loading && !filteredAndSorted.length && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-12 text-center text-slate-400">
          <HardDrive className="mx-auto h-8 w-8 text-slate-600 mb-3" />
          <p>No nodes match current filters.</p>
        </div>
      )}

      {viewMode === "grid" && filteredAndSorted.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAndSorted.map((panel) => (
            <div
              key={panel.panelId}
              className="group relative flex flex-col rounded-xl border border-slate-700 bg-slate-900/40 p-5 hover:border-slate-500 transition-all hover:shadow-lg hover:shadow-cyan-900/5"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                    {panel.panelId}
                  </h3>
                  <p className="font-mono text-xs text-slate-500 mt-1">
                    {panel.macAddress}
                  </p>
                </div>
                <div
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(panel.status)}`}
                >
                  {getStatusIcon(panel.status)}
                  {panel.status}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5 mt-auto text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <HardDrive className="h-3 w-3" /> Firmware
                  </span>
                  <span className="font-mono text-slate-300">
                    v{panel.firmwareVersion}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Location
                  </span>
                  <span
                    className="text-slate-300 truncate"
                    title={`${panel.gpsLat}, ${panel.gpsLng}`}
                  >
                    {panel.gpsLat
                      ? `${panel.gpsLat.toFixed(2)}, ${panel.gpsLng.toFixed(2)}`
                      : "Unknown"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-auto">
                <p className="text-xs text-slate-500">
                  Seen{" "}
                  {formatDistanceToNow(parseISO(panel.lastSeenUtc), {
                    addSuffix: true,
                  })}
                </p>
                <div className="flex gap-2">
                  <Link
                    href={`/panel?id=${encodeURIComponent(panel.panelId)}`}
                    className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    Console
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === "table" && filteredAndSorted.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/80 text-left text-slate-400 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 font-medium">Panel ID</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">MAC Address</th>
                <th className="px-4 py-3 font-medium">Firmware</th>
                <th className="px-4 py-3 font-medium">GPS</th>
                <th className="px-4 py-3 font-medium">Last seen</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/30">
              {filteredAndSorted.map((panel) => (
                <tr
                  key={panel.panelId}
                  className="hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-slate-200">
                    {panel.panelId}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${getStatusStyle(panel.status)}`}
                    >
                      {panel.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">
                    {panel.macAddress}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    v{panel.firmwareVersion}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 opacity-50" />
                      {panel.gpsLat
                        ? `${panel.gpsLat}, ${panel.gpsLng}`
                        : "N/A"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {formatDistanceToNow(parseISO(panel.lastSeenUtc), {
                      addSuffix: true,
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/panel?id=${encodeURIComponent(panel.panelId)}`}
                      className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium"
                    >
                      Inspect <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800 pt-4 text-sm text-slate-400">
        <span>
          Showing{" "}
          <strong className="text-slate-200">
            {Math.min(offset + 1, total)}
          </strong>{" "}
          to{" "}
          <strong className="text-slate-200">
            {Math.min(offset + limit, total)}
          </strong>{" "}
          of <strong className="text-slate-200">{total}</strong> nodes
        </span>
        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={(event) => {
              setOffset(0);
              setLimit(Number(event.target.value));
            }}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 outline-none mr-2"
          >
            {[25, 50, 100].map((v) => (
              <option key={v} value={v}>
                {v} / page
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOffset((prev) => Math.max(prev - limit, 0))}
            disabled={offset === 0}
            className="flex items-center gap-1 rounded bg-slate-800 px-3 py-1.5 disabled:opacity-30 hover:bg-slate-700"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <button
            type="button"
            onClick={() => setOffset((prev) => prev + limit)}
            disabled={offset + limit >= total}
            className="flex items-center gap-1 rounded bg-slate-800 px-3 py-1.5 disabled:opacity-30 hover:bg-slate-700"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
