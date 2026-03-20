"use client";

import { useEffect, useState } from "react";
import { getDashboardSummary } from "@/lib/api/ccms-api";
import type { DashboardSummary } from "@/lib/api/types";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const next = await getDashboardSummary();
        if (mounted) {
          setSummary(next);
          setError(null);
        }
      } catch (loadError) {
        if (mounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load dashboard summary."
          );
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  if (!summary && !error) {
    return <p className="text-slate-300">Loading fleet summary...</p>;
  }

  if (error) {
    return <p className="text-rose-300">{error}</p>;
  }

  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-semibold">Global Command Center</h2>
      <p className="text-sm text-slate-300">
        Aggregated from `CCMS_PANELS`, `FAULT_LOGS`, and Timestream 24-hour
        energy query.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard title="Total Nodes" value={String(summary?.totalPanels ?? 0)} />
        <MetricCard
          title="Active Alarms"
          value={String(summary?.activeAlarms ?? 0)}
        />
        <MetricCard
          title="Energy (24h)"
          value={`${summary?.energyLast24hKwh ?? 0} kWh`}
        />
      </div>

      <p className="text-xs text-slate-400">
        Snapshot UTC: {summary?.generatedAtUtc ?? "-"}
      </p>
    </section>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-cyan-300">{value}</p>
    </div>
  );
}
