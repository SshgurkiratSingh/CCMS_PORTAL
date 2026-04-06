"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { PanelState, AlertSeverity } from "@/lib/api/types";
import { Button, Card, Chip, Input } from "@heroui/react";

// ── Page header ──────────────────────────────────────────────────────────────
export function PageHeader({
  icon, title, description, action,
}: {
  icon: ReactNode; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#26263a] pb-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
          {icon}
          {title}
        </h2>
        {description && <p className="text-sm text-[#8080a0]">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── Section card ─────────────────────────────────────────────────────────────
export function SectionCard({
  children, className = "",
}: {
  children: ReactNode; className?: string;
}) {
  return (
    <Card className={`rounded-xl border border-[#26263a] border-t-white/5 bg-[#111118]/80 ${className}`}>
      {children}
    </Card>
  );
}

// ── Card header row ───────────────────────────────────────────────────────────
export function CardHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#26263a] pb-3 mb-4">
      {icon}
      <h3 className="text-sm font-semibold text-[#c8c8e0] tracking-wide">{title}</h3>
    </div>
  );
}

// ── Status chip (panel state) ─────────────────────────────────────────────────
const PANEL_STATUS_STYLES: Record<PanelState, string> = {
  ONLINE:  "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  OFFLINE: "bg-[#26263a]/60    text-[#8080a0]   border-[#32324a]",
  FAULT:   "bg-rose-500/10    text-rose-400    border-rose-500/25 animate-pulse",
  UNKNOWN: "bg-amber-500/10   text-amber-400   border-amber-500/25",
};

const PANEL_DOT: Record<PanelState, string> = {
  ONLINE:  "bg-emerald-400",
  OFFLINE: "bg-[#606080]",
  FAULT:   "bg-rose-400",
  UNKNOWN: "bg-amber-400",
};

export function PanelStatusChip({ status }: { status: PanelState }) {
  return (
    <Chip
      variant="soft"
      size="sm"
      className={`inline-flex items-center gap-1 border text-[10px] font-bold uppercase tracking-wider ${PANEL_STATUS_STYLES[status] ?? PANEL_STATUS_STYLES.UNKNOWN}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${PANEL_DOT[status] ?? PANEL_DOT.UNKNOWN}`} />
      {status}
    </Chip>
  );
}

// ── Severity chip ─────────────────────────────────────────────────────────────
const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  CRITICAL: "bg-rose-500/10   text-rose-400   border-rose-500/25",
  HIGH:     "bg-orange-500/10 text-orange-400 border-orange-500/25",
  MEDIUM:   "bg-amber-500/10  text-amber-400  border-amber-500/25",
  LOW:      "bg-violet-500/10 text-violet-400 border-violet-500/25",
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
    <span className="inline-flex items-center rounded border border-[#26263a] bg-[#18181f] px-2 py-0.5 font-mono text-[10px] text-[#a0a0c0]">
      {code}
    </span>
  );
}

// ── Banners ───────────────────────────────────────────────────────────────────
export function ErrorBanner({ message }: { message: string }) {
  return (
    <Card className="flex items-center gap-2.5 rounded-lg border border-rose-800/50 bg-rose-950/30 p-4 text-sm text-rose-300">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {message}
    </Card>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <Card className="flex items-center gap-2.5 rounded-lg border border-emerald-800/40 bg-emerald-950/25 p-4 text-sm text-emerald-300">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      {message}
    </Card>
  );
}

export function WarningBanner({ message }: { message: string }) {
  return (
    <Card className="flex items-center gap-2.5 rounded-lg border border-amber-800/40 bg-amber-950/25 p-4 text-sm text-amber-300">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {message}
    </Card>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, message }: { icon: ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[#26263a] border-dashed bg-[#111118]/40 p-14 text-center text-[#606080]">
      <div className="mb-3 opacity-25">{icon}</div>
      <p className="text-sm text-[#8080a0]">{message}</p>
    </div>
  );
}

// ── Loading row ───────────────────────────────────────────────────────────────
export function LoadingRow({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[#8080a0]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#26263a] border-t-violet-400" />
      {message}
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between rounded-xl border border-[#26263a] bg-[#111118]/80 p-4">
      {children}
    </div>
  );
}

// ── Native select ─────────────────────────────────────────────────────────────
export function NativeSelect({
  value, onChange, children, className = "",
}: {
  value: string; onChange: (v: string) => void; children: ReactNode; className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md border border-[#26263a] bg-[#07070b] px-3 py-2 text-sm text-[#c8c8e0] outline-none focus:border-violet-500/60 transition-colors ${className}`}
    >
      {children}
    </select>
  );
}

// ── Toolbar search input ──────────────────────────────────────────────────────
export function ToolbarSearchInput({
  value, onChange, placeholder, className = "",
}: {
  value: string; onChange: (value: string) => void; placeholder: string; className?: string;
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

// ── Segmented toggle ──────────────────────────────────────────────────────────
export function SegmentedToggle({
  options, value, onChange,
}: {
  options: Array<{ key: string; label: string; icon?: ReactNode }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex rounded-lg border border-[#26263a] bg-[#07070b] p-1 shrink-0">
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
