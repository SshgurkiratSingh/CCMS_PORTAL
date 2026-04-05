"use client";

import { useEffect, useState, useMemo } from "react";
import { acknowledgeAlert, getAlerts } from "@/lib/api/ccms-api";
import { useAuth } from "@/components/auth-provider";
import type { AlertRecord, AlertSeverity } from "@/lib/api/types";
import {
  BellRing,
  ShieldAlert,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertOctagon,
  RefreshCcw,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Button } from "@heroui/react";
import {
  PageHeader,
  SectionCard,
  SeverityChip,
  FaultCodeTag,
  ErrorBanner,
  EmptyState,
  LoadingRow,
  Toolbar,
  NativeSelect,
} from "@/components/ui";

const severities: AlertSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const SEVERITY_BORDER: Record<AlertSeverity, string> = {
  CRITICAL: "border-rose-500/25 bg-rose-500/5",
  HIGH: "border-orange-500/25 bg-orange-500/5",
  MEDIUM: "border-amber-500/25 bg-amber-500/5",
  LOW: "border-blue-500/25 bg-blue-500/5",
};

const SEVERITY_ICON: Record<AlertSeverity, React.ReactNode> = {
  CRITICAL: <AlertOctagon className="h-5 w-5 text-rose-400" />,
  HIGH: <ShieldAlert className="h-5 w-5 text-orange-400" />,
  MEDIUM: <AlertTriangle className="h-5 w-5 text-amber-400" />,
  LOW: <BellRing className="h-5 w-5 text-blue-400" />,
};

export default function AlertsPage() {
  const { session } = useAuth();
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "ALL">(
    "ALL",
  );
  const [statusFilter, setStatusFilter] = useState<
    "ACTIVE" | "ACKNOWLEDGED" | "ALL"
  >("ACTIVE");
  const [allAlerts, setAllAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
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
      setAllAlerts((prev) =>
        prev.map((a) =>
          a.alertId === alertId
            ? {
                ...a,
                status: "ACKNOWLEDGED",
                acknowledgedBy: operatorName,
                acknowledgedAtUtc: new Date().toISOString(),
              }
            : a,
        ),
      );
    } catch (ackError) {
      setError(
        ackError instanceof Error
          ? ackError.message
          : "Alert acknowledgement failed.",
      );
    }
  };

  const filteredAlerts = useMemo(
    () =>
      allAlerts.filter((a) => {
        const matchSeverity =
          severityFilter === "ALL" || a.severity === severityFilter;
        const matchStatus = statusFilter === "ALL" || a.status === statusFilter;
        return matchSeverity && matchStatus;
      }),
    [allAlerts, severityFilter, statusFilter],
  );

  const activeCount = allAlerts.filter((a) => a.status === "ACTIVE").length;
  const criticalCount = allAlerts.filter(
    (a) => a.status === "ACTIVE" && a.severity === "CRITICAL",
  ).length;

  return (
    <section className="space-y-6">
      <PageHeader
        icon={<ShieldAlert className="h-6 w-6 text-rose-400" />}
        title="Alerts Triage Board"
        description="Manage system faults, operational constraints, and hardware alarms."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <SectionCard className="p-4 border-rose-900/40 bg-rose-950/15">
          <p className="text-xs uppercase tracking-wide text-rose-400/80 font-semibold mb-1">
            Critical Active
          </p>
          <p className="text-3xl font-bold text-rose-400">{criticalCount}</p>
        </SectionCard>
        <SectionCard className="p-4 border-amber-900/40 bg-amber-950/15">
          <p className="text-xs uppercase tracking-wide text-amber-400/80 font-semibold mb-1">
            Total Active
          </p>
          <p className="text-3xl font-bold text-amber-400">{activeCount}</p>
        </SectionCard>

        <div className="md:col-span-2">
          <Toolbar>
            <div className="flex flex-wrap items-center gap-3 w-full">
              <NativeSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
              </NativeSelect>
              <NativeSelect
                value={severityFilter}
                onChange={(v) => setSeverityFilter(v as typeof severityFilter)}
              >
                <option value="ALL">All Severities</option>
                {severities.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelect>
              <Button
                onPress={() => void load()}
                size="sm"
                variant="secondary"
                className="ml-auto flex items-center gap-1.5"
              >
                <RefreshCcw className="h-4 w-4" /> Refresh
              </Button>
            </div>
          </Toolbar>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading && !allAlerts.length ? (
        <LoadingRow message="Loading fault logs..." />
      ) : filteredAlerts.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-10 w-10" />}
          message="No alerts matching current filters."
        />
      ) : (
        <div className="grid gap-3">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.alertId}
              className={`flex flex-col sm:flex-row gap-4 p-4 rounded-xl border transition-colors ${
                alert.status === "ACTIVE"
                  ? "bg-slate-900/50 border-slate-700 hover:border-slate-600"
                  : "bg-slate-950/30 border-slate-800/60 opacity-60"
              }`}
            >
              <div className="flex gap-4 items-start flex-1">
                <div
                  className={`mt-0.5 p-2 rounded-lg border ${SEVERITY_BORDER[alert.severity]}`}
                >
                  {SEVERITY_ICON[alert.severity]}
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-200">
                      {alert.message || `Fault Code: ${alert.faultCode}`}
                    </h3>
                    <SeverityChip severity={alert.severity} />
                    <FaultCodeTag code={alert.faultCode} />
                  </div>
                  <div className="text-sm text-slate-400 flex items-center gap-3">
                    <span>
                      Node{" "}
                      <strong className="text-slate-300">
                        {alert.panelId}
                      </strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(parseISO(alert.raisedAtUtc), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col justify-end sm:justify-center border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-4 min-w-[8rem]">
                {alert.status === "ACTIVE" ? (
                  <Button
                    onPress={() => void onAcknowledge(alert.alertId)}
                    size="sm"
                    variant="danger-soft"
                    className="w-full"
                  >
                    Acknowledge
                  </Button>
                ) : (
                  <div className="text-xs text-slate-500 flex flex-col gap-1 items-end">
                    <span className="flex items-center gap-1 text-emerald-500/80">
                      <CheckCircle2 className="h-3.5 w-3.5" /> ACK
                    </span>
                    <span>By {alert.acknowledgedBy}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
