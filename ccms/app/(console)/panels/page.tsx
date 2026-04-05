"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { getPanels } from "@/lib/api/ccms-api";
import type { PanelRecord, PanelState } from "@/lib/api/types";
import {
  Search, MapPin, Activity, ChevronLeft, ChevronRight,
  HardDrive, Map as MapIcon, LayoutGrid, List, Filter,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Button } from "@heroui/react";
import {
  PageHeader, PanelStatusChip, ErrorBanner, EmptyState,
  LoadingRow, Toolbar, NativeSelect, ToolbarSearchInput, SegmentedToggle,
} from "@/components/ui";

const FleetMap = dynamic(() => import("@/components/fleet-map"), {
  ssr: false,
  loading: () => (
    <div className="h-150 w-full rounded-xl border border-slate-700 bg-slate-900/40 flex items-center justify-center text-slate-500">
      <Activity className="animate-spin h-6 w-6 mr-2" /> Loading Spatial Maps...
    </div>
  ),
});

const statuses: Array<PanelState | "ALL"> = ["ALL", "ONLINE", "OFFLINE", "FAULT", "UNKNOWN"];
type SortKey = "panelId" | "status" | "firmwareVersion" | "lastSeenUtc";

export default function PanelsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PanelRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<PanelState | "ALL">("ALL");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("panelId");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table" | "map">("grid");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await getPanels({ status: status === "ALL" ? undefined : status, limit, offset });
        if (mounted) { setRows(response.items); setTotal(response.total); setError(null); }
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Unable to fetch panel roster.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [limit, offset, status]);

  const filteredAndSorted = useMemo(() => {
    let next = [...rows];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      next = next.filter(
        (p) => p.panelId.toLowerCase().includes(q) || p.deviceId.toLowerCase().includes(q) || p.firmwareVersion.toLowerCase().includes(q),
      );
    }
    next.sort((a, b) => {
      if (sortKey === "lastSeenUtc") return new Date(b.lastSeenUtc).getTime() - new Date(a.lastSeenUtc).getTime();
      return String(a[sortKey]).localeCompare(String(b[sortKey]));
    });
    return next;
  }, [rows, sortKey, searchQuery]);

  return (
    <section className="space-y-6">
      <PageHeader
        icon={<HardDrive className="h-6 w-6 text-cyan-400" />}
        title="Fleet Ecosystem"
        description="Monitor and manage edge network distribution nodes."
        action={
          <Button variant="primary" onPress={() => router.push("/manage-panel")} className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> Add New Node
          </Button>
        }
      />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 z-10" />
            <ToolbarSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search ID, Device ID..."
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <NativeSelect value={status} onChange={(v) => { setOffset(0); setStatus(v as PanelState | "ALL"); }}>
              {statuses.map((s) => <option key={s} value={s}>{s === "ALL" ? "All Statuses" : s}</option>)}
            </NativeSelect>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
            <span className="text-xs text-slate-500">Sort</span>
            <NativeSelect value={sortKey} onChange={(v) => setSortKey(v as SortKey)}>
              <option value="lastSeenUtc">Latest Activity</option>
              <option value="panelId">Panel ID</option>
              <option value="status">Health State</option>
            </NativeSelect>
          </div>
        </div>

        <SegmentedToggle
          value={viewMode}
          onChange={(mode) => setViewMode(mode as "grid" | "table" | "map")}
          options={[
            { key: "map", label: "Map", icon: <MapIcon className="h-4 w-4" /> },
            { key: "grid", label: "Grid", icon: <LayoutGrid className="h-4 w-4" /> },
            { key: "table", label: "Table", icon: <List className="h-4 w-4" /> },
          ]}
        />
      </Toolbar>

      {error && <ErrorBanner message={error} />}
      {loading && <LoadingRow message="Fetching latest topology..." />}
      {!loading && !filteredAndSorted.length && (
        <EmptyState icon={<HardDrive className="h-8 w-8" />} message="No nodes match current filters." />
      )}

      {viewMode === "map" && filteredAndSorted.length > 0 && (
        <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-900/40 p-2">
          <FleetMap panels={filteredAndSorted} />
        </div>
      )}

      {viewMode === "grid" && filteredAndSorted.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredAndSorted.map((panel) => (
              <div
                key={panel.panelId}
                className="group flex flex-col rounded-xl border border-slate-700 bg-slate-900/40 p-5 hover:border-slate-500 transition-all hover:shadow-lg hover:shadow-cyan-900/5 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                      {panel.panelId}
                    </h3>
                    <p className="font-mono text-xs text-slate-500 mt-0.5">{panel.deviceId}</p>
                  </div>
                  <PanelStatusChip status={panel.status} />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <HardDrive className="h-3 w-3" /> Firmware
                    </span>
                    <span className="font-mono text-slate-300">v{panel.firmwareVersion}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Location
                    </span>
                    <span className="text-slate-300 truncate" title={`${panel.gpsLat}, ${panel.gpsLng}`}>
                      {panel.gpsLat ? `${panel.gpsLat.toFixed(2)}, ${panel.gpsLng.toFixed(2)}` : "Unknown"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-auto">
                  <p className="text-xs text-slate-500">
                    Seen {formatDistanceToNow(parseISO(panel.lastSeenUtc), { addSuffix: true })}
                  </p>
                  <Link
                    href={`/panel?id=${encodeURIComponent(panel.panelId)}`}
                    className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    Console
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden lg:block border border-slate-700 rounded-xl overflow-hidden bg-slate-900/40 p-2 lg:sticky lg:top-4 h-[calc(100vh-12rem)] min-h-100">
            <FleetMap panels={filteredAndSorted} className="h-full w-full rounded-lg border border-slate-800" />
          </div>
        </div>
      )}

      {viewMode === "table" && filteredAndSorted.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/80 text-left text-slate-400 border-b border-slate-700">
              <tr>
                {["Panel ID", "Status", "Device ID", "Firmware", "GPS", "Last seen", ""].map((h) => (
                  <th key={h} className={`px-4 py-3 font-medium ${h === "" ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/30">
              {filteredAndSorted.map((panel) => (
                <tr key={panel.panelId} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-200">{panel.panelId}</td>
                  <td className="px-4 py-3"><PanelStatusChip status={panel.status} /></td>
                  <td className="px-4 py-3 font-mono text-slate-400">{panel.deviceId}</td>
                  <td className="px-4 py-3 text-slate-400">v{panel.firmwareVersion}</td>
                  <td className="px-4 py-3 text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 opacity-50" />
                      {panel.gpsLat ? `${panel.gpsLat}, ${panel.gpsLng}` : "N/A"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {formatDistanceToNow(parseISO(panel.lastSeenUtc), { addSuffix: true })}
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

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800 pt-4 text-sm text-slate-400">
        <span>
          Showing <strong className="text-slate-200">{Math.min(offset + 1, total)}</strong> to{" "}
          <strong className="text-slate-200">{Math.min(offset + limit, total)}</strong> of{" "}
          <strong className="text-slate-200">{total}</strong> nodes
        </span>
        <div className="flex items-center gap-2">
          <NativeSelect value={String(limit)} onChange={(v) => { setOffset(0); setLimit(Number(v)); }}>
            {[25, 50, 100].map((v) => <option key={v} value={v}>{v} / page</option>)}
          </NativeSelect>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => setOffset((p) => Math.max(p - limit, 0))}
            isDisabled={offset === 0}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => setOffset((p) => p + limit)}
            isDisabled={offset + limit >= total}
            className="flex items-center gap-1"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
