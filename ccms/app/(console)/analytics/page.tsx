"use client";

import { useMemo, useState } from "react";
import { getPanelTelemetry } from "@/lib/api/ccms-api";
import type { TelemetryResponse } from "@/lib/api/types";

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
      setResult(response);
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

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Historical Telemetry & Analytics</h2>
      <p className="text-sm text-slate-300">
        Queries Timestream using panel and ISO date range.
      </p>

      <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border border-slate-700 bg-slate-950/45 p-4 md:grid-cols-4">
        <label className="text-sm">
          <span className="block text-slate-300">Panel ID</span>
          <input
            required
            value={panelId}
            onChange={(event) => setPanelId(event.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5"
          />
        </label>

        <label className="text-sm">
          <span className="block text-slate-300">Start Date (UTC)</span>
          <input
            required
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5"
          />
        </label>

        <label className="text-sm">
          <span className="block text-slate-300">End Date (UTC)</span>
          <input
            required
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5"
          />
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {loading ? "Querying..." : "Run Query"}
          </button>
        </div>
      </form>

      {error && <p className="text-rose-300">{error}</p>}

      {result && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-700 bg-slate-950/45 p-4 text-sm text-slate-200">
            <p>Panel: {result.panelId}</p>
            <p>
              Window: {result.startUtc} to {result.endUtc}
            </p>
            <p>Points: {result.points.length}</p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-950/70 text-left text-slate-300">
                <tr>
                  <th className="px-3 py-2">Timestamp UTC</th>
                  <th className="px-3 py-2">Phase A kW</th>
                  <th className="px-3 py-2">Phase B kW</th>
                  <th className="px-3 py-2">Phase C kW</th>
                  <th className="px-3 py-2">Total kW</th>
                </tr>
              </thead>
              <tbody>
                {result.points.map((point) => (
                  <tr key={point.timestampUtc} className="border-t border-slate-800">
                    <td className="px-3 py-2">{point.timestampUtc}</td>
                    <td className="px-3 py-2">{point.phaseAkw}</td>
                    <td className="px-3 py-2">{point.phaseBkw}</td>
                    <td className="px-3 py-2">{point.phaseCkw}</td>
                    <td className="px-3 py-2">{point.totalKw}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
