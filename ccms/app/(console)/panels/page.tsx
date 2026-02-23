"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getPanels } from "@/lib/api/ccms-api";
import type { PanelRecord, PanelState } from "@/lib/api/types";

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
  const [status, setStatus] = useState<PanelState | "ALL">("ONLINE");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("panelId");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              : "Unable to fetch panel roster."
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

  const sorted = useMemo(() => {
    const next = [...rows];
    next.sort((a, b) => {
      const left = String(a[sortKey]);
      const right = String(b[sortKey]);
      return left.localeCompare(right);
    });
    return next;
  }, [rows, sortKey]);

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Panel Roster / Inventory</h2>
      <p className="text-sm text-slate-300">
        Source: paginated GSI query over `CCMS_PANELS` cached status data.
      </p>

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="space-x-2">
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => {
              setOffset(0);
              setStatus(event.target.value as PanelState | "ALL");
            }}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
          >
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="space-x-2">
          <span>Limit</span>
          <select
            value={limit}
            onChange={(event) => {
              setOffset(0);
              setLimit(Number(event.target.value));
            }}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
          >
            {[25, 50, 100].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="space-x-2">
          <span>Sort</span>
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
          >
            <option value="panelId">Panel ID</option>
            <option value="status">Status</option>
            <option value="firmwareVersion">Firmware</option>
            <option value="lastSeenUtc">Last Seen</option>
          </select>
        </label>
      </div>

      {error && <p className="text-rose-300">{error}</p>}
      {loading && <p className="text-slate-300">Loading panels...</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-950/80 text-left text-slate-300">
            <tr>
              <th className="px-3 py-2">Panel</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">MAC</th>
              <th className="px-3 py-2">Firmware</th>
              <th className="px-3 py-2">GPS</th>
              <th className="px-3 py-2">Last Seen UTC</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((panel) => (
              <tr key={panel.panelId} className="border-t border-slate-800">
                <td className="px-3 py-2">
                  <Link
                    href={`/panel?id=${encodeURIComponent(panel.panelId)}`}
                    className="text-cyan-300 underline underline-offset-4"
                  >
                    {panel.panelId}
                  </Link>
                </td>
                <td className="px-3 py-2">{panel.status}</td>
                <td className="px-3 py-2">{panel.macAddress}</td>
                <td className="px-3 py-2">{panel.firmwareVersion}</td>
                <td className="px-3 py-2">
                  {panel.gpsLat}, {panel.gpsLng}
                </td>
                <td className="px-3 py-2">{panel.lastSeenUtc}</td>
              </tr>
            ))}
            {!sorted.length && !loading && (
              <tr>
                <td className="px-3 py-3 text-slate-400" colSpan={6}>
                  No panel records for current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>
          Offset {offset} | Showing {rows.length} of {total}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOffset((prev) => Math.max(prev - limit, 0))}
            disabled={offset === 0}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setOffset((prev) => prev + limit)}
            disabled={offset + limit >= total}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
