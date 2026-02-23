"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { postPanelCommand, getPanelStatus } from "@/lib/api/ccms-api";
import type { PanelLiveStatus } from "@/lib/api/types";

export default function PanelDetailsPage() {
  const searchParams = useSearchParams();
  const panelId = searchParams.get("id") ?? "";

  const [status, setStatus] = useState<PanelLiveStatus | null>(null);
  const [manualState, setManualState] = useState<"ON" | "OFF">("ON");
  const [scheduleStart, setScheduleStart] = useState("18:00");
  const [scheduleEnd, setScheduleEnd] = useState("06:00");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!panelId) {
      return;
    }

    try {
      const next = await getPanelStatus(panelId);
      setStatus(next);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to fetch panel shadow status."
      );
    }
  }, [panelId]);

  useEffect(() => {
    if (!panelId) {
      return;
    }

    void loadStatus();
    const timer = setInterval(() => {
      void loadStatus();
    }, 10000);

    return () => clearInterval(timer);
  }, [loadStatus, panelId]);

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
          : "Manual command failed."
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
          : "Schedule command failed."
      );
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Tactical Node Interface</h2>
        <Link href="/panels" className="text-sm text-cyan-300 underline">
          Back to panels
        </Link>
      </div>

      <p className="text-sm text-slate-300">Panel ID: {panelId || "Not provided"}</p>
      {!panelId && (
        <p className="text-sm text-amber-300">
          Open this page as `/panel?id=your-panel-id`.
        </p>
      )}

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {message && <p className="text-sm text-emerald-300">{message}</p>}

      <div className="grid gap-3 sm:grid-cols-4">
        <StatBox label="Voltage" value={status ? `${status.voltage} V` : "-"} />
        <StatBox label="Current" value={status ? `${status.current} A` : "-"} />
        <StatBox label="Energy" value={status ? `${status.kwh} kWh` : "-"} />
        <StatBox
          label="Reported UTC"
          value={status?.reportedAtUtc ?? "Awaiting first shadow read"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-950/45 p-4">
          <h3 className="font-semibold">Manual ON/OFF Command</h3>
          <p className="mt-1 text-sm text-slate-300">
            Writes to shadow desired state via `/api/v1/panels/:panelId/command`.
          </p>

          <div className="mt-3 flex items-center gap-2">
            <select
              value={manualState}
              onChange={(event) =>
                setManualState(event.target.value as "ON" | "OFF")
              }
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            >
              <option value="ON">ON</option>
              <option value="OFF">OFF</option>
            </select>
            <button
              type="button"
              onClick={() => void sendManualCommand()}
              className="rounded bg-cyan-400 px-3 py-1.5 text-sm font-semibold text-slate-950"
            >
              Send
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950/45 p-4">
          <h3 className="font-semibold">RTC Schedule Command</h3>
          <p className="mt-1 text-sm text-slate-300">
            Updates desired schedule for edge synchronization over MQTT delta.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <label className="space-x-2">
              <span>Start</span>
              <input
                type="time"
                value={scheduleStart}
                onChange={(event) => setScheduleStart(event.target.value)}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1"
              />
            </label>
            <label className="space-x-2">
              <span>End</span>
              <input
                type="time"
                value={scheduleEnd}
                onChange={(event) => setScheduleEnd(event.target.value)}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1"
              />
            </label>
            <button
              type="button"
              onClick={() => void sendScheduleCommand()}
              className="rounded bg-cyan-400 px-3 py-1.5 font-semibold text-slate-950"
            >
              Update
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-cyan-200">{value}</p>
    </div>
  );
}
