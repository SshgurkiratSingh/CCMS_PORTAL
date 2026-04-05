"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { PanelState, AlertSeverity } from "@/lib/api/types";
import { Button, Card, Chip, Input } from "@heroui/react";

// ── Page header ──────────────────────────────────────────────────────────────
export function PageHeader({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-100 flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {description && <p className="text-sm text-slate-400">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── Section card ─────────────────────────────────────────────────────────────
export function SectionCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={`rounded-xl border border-slate-800 bg-slate-900/40 ${className}`}
    >
      {children}
    </Card>
  );
}

// ── Card header row ───────────────────────────────────────────────────────────
export function CardHeader({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 mb-4">
      {icon}
      <h3 className="text-base font-semibold text-slate-200">{title}</h3>
    </div>
  );
}

// ── Status chip (panel state) ─────────────────────────────────────────────────
const PANEL_STATUS_STYLES: Record<PanelState, string> = {
  ONLINE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  OFFLINE: "bg-slate-500/10 text-slate-400 border-slate-500/25",
  FAULT: "bg-rose-500/10 text-rose-400 border-rose-500/25 animate-pulse",
  UNKNOWN: "bg-amber-500/10 text-amber-400 border-amber-500/25",
};

export function PanelStatusChip({ status }: { status: PanelState }) {
  return (
    <Chip
      variant="soft"
      size="sm"
      className={`inline-flex items-center gap-1 border text-[10px] font-bold uppercase tracking-wider ${PANEL_STATUS_STYLES[status] ?? PANEL_STATUS_STYLES.UNKNOWN}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${status === "ONLINE" ? "bg-emerald-400" : status === "FAULT" ? "bg-rose-400" : status === "OFFLINE" ? "bg-slate-400" : "bg-amber-400"}`}
      />
      {status}
    </Chip>
  );
}

// ── Severity chip (alert severity) ───────────────────────────────────────────
const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  CRITICAL: "bg-rose-500/10 text-rose-400 border-rose-500/25",
  HIGH: "bg-orange-500/10 text-orange-400 border-orange-500/25",
  MEDIUM: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  LOW: "bg-blue-500/10 text-blue-400 border-blue-500/25",
};

export function SeverityChip({ severity }: { severity: AlertSeverity }) {
  return (
    <Chip
      variant="soft"
      size="sm"
      className={`inline-flex items-center border text-[10px] font-bold uppercase tracking-wider ${SEVERITY_STYLES[severity]}`}
    >
      {severity}
    </Chip>
  );
}

// ── Fault code tag ────────────────────────────────────────────────────────────
export function FaultCodeTag({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center rounded border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">
      {code}
    </span>
  );
}

// ── Error banner ──────────────────────────────────────────────────────────────
export function ErrorBanner({ message }: { message: string }) {
  return (
    <Card className="flex items-center gap-2 rounded-lg border border-rose-900/50 bg-rose-950/30 p-4 text-sm text-rose-400">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {message}
    </Card>
  );
}

// ── Success banner ────────────────────────────────────────────────────────────
export function SuccessBanner({ message }: { message: string }) {
  return (
    <Card className="flex items-center gap-2 rounded-lg border border-emerald-900/50 bg-emerald-950/30 p-4 text-sm text-emerald-400">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      {message}
    </Card>
  );
}

// ── Warning banner ────────────────────────────────────────────────────────────
export function WarningBanner({ message }: { message: string }) {
  return (
    <Card className="flex items-center gap-2 rounded-lg border border-amber-900/50 bg-amber-950/30 p-4 text-sm text-amber-400">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {message}
    </Card>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  message,
}: {
  icon: ReactNode;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 border-dashed bg-slate-900/20 p-12 text-center text-slate-500">
      <div className="mb-3 opacity-40">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Loading row ───────────────────────────────────────────────────────────────
export function LoadingRow({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-slate-300" />
      {message}
    </div>
  );
}

// ── Toolbar wrapper ───────────────────────────────────────────────────────────
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
      {children}
    </div>
  );
}

// ── Native select ─────────────────────────────────────────────────────────────
export function NativeSelect({
  value,
  onChange,
  children,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500 transition-colors ${className}`}
    >
      {children}
    </select>
  );
}

export function ToolbarSearchInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <Input
      type="text"
      variant="secondary"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    />
  );
}

export function SegmentedToggle({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: string; label: string; icon?: ReactNode }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex rounded-lg border border-slate-700 bg-slate-950 p-1 shrink-0">
      {options.map((option) => (
        <Button
          key={option.key}
          size="sm"
          variant={value === option.key ? "primary" : "ghost"}
          onPress={() => onChange(option.key)}
          className="flex items-center gap-1.5 capitalize"
        >
          {option.icon}
          {option.label}
        </Button>
      ))}
    </div>
  );
}
