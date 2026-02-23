"use client";

import { useEffect, useState } from "react";
import { acknowledgeAlert, getAlerts } from "@/lib/api/ccms-api";
import { useAuth } from "@/components/auth-provider";
import type { AlertRecord, AlertSeverity } from "@/lib/api/types";

const severities: AlertSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function AlertsPage() {
  const { session } = useAuth();
  const [severity, setSeverity] = useState<AlertSeverity>("CRITICAL");
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (targetSeverity: AlertSeverity) => {
    setLoading(true);
    try {
      const response = await getAlerts(targetSeverity);
      setAlerts(response.items);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to fetch alerts."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(severity);
  }, [severity]);

  const onAcknowledge = async (alertId: string) => {
    if (!session?.username) {
      setError("Operator identity is unavailable.");
      return;
    }

    try {
      await acknowledgeAlert(alertId, session.username);
      await load(severity);
    } catch (ackError) {
      setError(
        ackError instanceof Error
          ? ackError.message
          : "Alert acknowledgement failed."
      );
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Fault & Alarm Ledger</h2>
      <p className="text-sm text-slate-300">
        Reads and updates alarm state in `FAULT_LOGS` with operator audit data.
      </p>

      <label className="inline-flex items-center gap-2 text-sm">
        <span>Severity</span>
        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value as AlertSeverity)}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
        >
          {severities.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      {loading && <p className="text-slate-300">Loading alerts...</p>}
      {error && <p className="text-rose-300">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-950/70 text-left text-slate-300">
            <tr>
              <th className="px-3 py-2">Alert ID</th>
              <th className="px-3 py-2">Panel</th>
              <th className="px-3 py-2">Fault</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Raised UTC</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.alertId} className="border-t border-slate-800">
                <td className="px-3 py-2">{alert.alertId}</td>
                <td className="px-3 py-2">{alert.panelId}</td>
                <td className="px-3 py-2">{alert.faultCode}</td>
                <td className="px-3 py-2">{alert.status}</td>
                <td className="px-3 py-2">{alert.raisedAtUtc}</td>
                <td className="px-3 py-2">
                  {alert.status === "ACTIVE" ? (
                    <button
                      type="button"
                      onClick={() => void onAcknowledge(alert.alertId)}
                      className="rounded bg-cyan-400 px-2 py-1 text-xs font-semibold text-slate-950"
                    >
                      Acknowledge
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">
                      by {alert.acknowledgedBy ?? "-"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {!alerts.length && !loading && (
              <tr>
                <td className="px-3 py-3 text-slate-400" colSpan={6}>
                  No alerts for current severity.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
