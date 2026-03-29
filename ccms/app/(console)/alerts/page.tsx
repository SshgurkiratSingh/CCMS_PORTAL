"use client";

import { useEffect, useState, useMemo } from "react";
import { acknowledgeAlert, getAlerts } from "@/lib/api/ccms-api";
import { useAuth } from "@/components/auth-provider";
import type { AlertRecord, AlertSeverity } from "@/lib/api/types";
import { BellRing, ShieldAlert, CheckCircle2, Clock, AlertTriangle, AlertOctagon, Filter } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

const severities: AlertSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function AlertsPage() {
  const { session } = useAuth();
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "ACKNOWLEDGED" | "ALL">("ACTIVE");
  const [allAlerts, setAllAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // For this UI, we fetch all severities and filter client side if the API allows or just fetch iteratively. 
      // The current API accepts undefined/optional severity to return all if not specified. Let's assume it returns all.
      // Modifying getAlerts call to fetch without severity constraint. 
      const response = await getAlerts(); 
      setAllAlerts(response.items);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to fetch alerts.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onAcknowledge = async (alertId: string) => {
    if (!session?.dashboardKey) {
      setError("Operator identity is unavailable.");
      return;
    }

    try {
      const operatorName = session.role || "Unknown Operator";
      await acknowledgeAlert(alertId, operatorName);
      // Optimistic update
      setAllAlerts(prev => prev.map(a => 
        a.alertId === alertId 
          ? { ...a, status: "ACKNOWLEDGED", acknowledgedBy: operatorName, acknowledgedAtUtc: new Date().toISOString() } 
          : a
      ));
    } catch (ackError) {
      setError(
        ackError instanceof Error
          ? ackError.message
          : "Alert acknowledgement failed.",
      );
    }
  };

  const filteredAlerts = useMemo(() => {
    return allAlerts.filter(a => {
      const matchSeverity = severityFilter === "ALL" || a.severity === severityFilter;
      const matchStatus = statusFilter === "ALL" || a.status === statusFilter;
      return matchSeverity && matchStatus;
    });
  }, [allAlerts, severityFilter, statusFilter]);

  const activeCount = allAlerts.filter(a => a.status === "ACTIVE").length;
  const criticalCount = allAlerts.filter(a => a.status === "ACTIVE" && a.severity === "CRITICAL").length;

  function getSeverityIcon(severity: AlertSeverity) {
    switch (severity) {
      case "CRITICAL": return <AlertOctagon className="h-5 w-5 text-rose-500" />;
      case "HIGH": return <ShieldAlert className="h-5 w-5 text-orange-500" />;
      case "MEDIUM": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "LOW": return <BellRing className="h-5 w-5 text-blue-500" />;
    }
  }

  function getSeverityColor(severity: AlertSeverity) {
    switch (severity) {
      case "CRITICAL": return "border-rose-500/30 bg-rose-500/10 text-rose-400";
      case "HIGH": return "border-orange-500/30 bg-orange-500/10 text-orange-400";
      case "MEDIUM": return "border-amber-500/30 bg-amber-500/10 text-amber-400";
      case "LOW": return "border-blue-500/30 bg-blue-500/10 text-blue-400";
    }
  }

  return (
    <section className="space-y-6 flex flex-col h-full">
      <div className="flex flex-col gap-2 border-b border-slate-800 pb-4">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-100 flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-rose-400" />
          Alerts Triage Board
        </h2>
        <p className="text-sm text-slate-400">
          Manage system faults, operational constraints, and hardware alarms.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-rose-900/50 bg-rose-950/20 p-4 flex flex-col justify-center">
          <p className="text-xs uppercase tracking-wide text-rose-400/80 font-semibold mb-1">Critical Active</p>
          <p className="text-3xl font-bold text-rose-400">{criticalCount}</p>
        </div>
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 flex flex-col justify-center">
          <p className="text-xs uppercase tracking-wide text-amber-400/80 font-semibold mb-1">Total Active</p>
          <p className="text-3xl font-bold text-amber-400">{activeCount}</p>
        </div>
        
        <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex flex-col justify-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
            <Filter className="h-4 w-4" /> Filter Triage Queue
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
            </select>
            
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Severities</option>
              {severities.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <button onClick={load} className="ml-auto rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors">
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-rose-400 text-sm p-3 rounded-lg bg-rose-950/30 border border-rose-900/50">{error}</p>}
      
      <div className="flex-1 min-h-[400px]">
        {loading && !allAlerts.length ? (
          <div className="flex items-center justify-center h-48 text-slate-400 gap-2">
            <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
            Loading fault logs...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-slate-800 border-dashed bg-slate-900/20 text-slate-500">
            <CheckCircle2 className="h-10 w-10 mb-3 text-slate-600" />
            <p>No alerts matching current filters.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredAlerts.map(alert => (
              <div 
                key={alert.alertId} 
                className={`flex flex-col sm:flex-row gap-4 p-4 rounded-xl border transition-colors ${
                  alert.status === "ACTIVE" 
                    ? "bg-slate-900/50 border-slate-700 hover:border-slate-600" 
                    : "bg-slate-950/30 border-slate-800/60 opacity-70"
                }`}
              >
                <div className="flex gap-4 items-start flex-1">
                  <div className={`mt-0.5 p-2 rounded-lg border ${getSeverityColor(alert.severity)}`}>
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-200">{alert.message || `Fault Code: ${alert.faultCode}`}</h3>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                        {alert.faultCode}
                      </span>
                    </div>
                    <div className="text-sm text-slate-400 flex items-center gap-3">
                      <span>Node <strong>{alert.panelId}</strong></span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDistanceToNow(parseISO(alert.raisedAtUtc), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex sm:flex-col justify-end sm:justify-center border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-4 min-w-[140px]">
                  {alert.status === "ACTIVE" ? (
                    <button
                      onClick={() => void onAcknowledge(alert.alertId)}
                      className="w-full rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-3 py-2 text-sm font-semibold text-rose-400 transition-colors"
                    >
                      Acknowledge
                    </button>
                  ) : (
                    <div className="text-xs text-slate-500 flex flex-col gap-1 items-end">
                      <span className="flex items-center gap-1 text-emerald-500/80"><CheckCircle2 className="h-3.5 w-3.5" /> ACK</span>
                      <span>By {alert.acknowledgedBy}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
