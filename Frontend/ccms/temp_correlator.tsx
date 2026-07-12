function DataCorrelator({ data }: { data: TelemetryPoint[] }) {
  if (!data || data.length < 2) return null;

  const anomalies: { time: string; msg: string; severity: "high" | "medium" }[] = [];

  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];

    // Detect voltage spikes/drops > 10% between consecutive reported intervals
    const vDiff = Math.abs(curr.avgVoltage - prev.avgVoltage);
    if (prev.avgVoltage > 0 && (vDiff / prev.avgVoltage) > 0.1) {
      if (curr.avgVoltage > prev.avgVoltage) {
         anomalies.push({ time: curr.timestampUtc, msg: `Sudden Voltage Spike: ${prev.avgVoltage.toFixed(1)}V ➔ ${curr.avgVoltage.toFixed(1)}V`, severity: "high" });
      } else {
         anomalies.push({ time: curr.timestampUtc, msg: `Sudden Voltage Drop: ${prev.avgVoltage.toFixed(1)}V ➔ ${curr.avgVoltage.toFixed(1)}V`, severity: "high" });
      }
    }

    // Detect sudden PF drops
    if (prev.totalPowerFactor > 0.8 && curr.totalPowerFactor < 0.7) {
      anomalies.push({ time: curr.timestampUtc, msg: `Abnormal Power Factor collapse: ${prev.totalPowerFactor.toFixed(2)} ➔ ${curr.totalPowerFactor.toFixed(2)}`, severity: "medium" });
    }

    // Current anomaly (lights acting up)
    const iDiff = Math.abs(curr.avgCurrent - prev.avgCurrent);
    if (prev.avgCurrent > 1 && (iDiff / prev.avgCurrent) > 0.5) {
       anomalies.push({ time: curr.timestampUtc, msg: `Large Current fluctuation: ${prev.avgCurrent.toFixed(1)}A ➔ ${curr.avgCurrent.toFixed(1)}A`, severity: "medium" });
    }
  }

  // Cap anomalies list to most recent 5 to avoid UI clutter
  const recentAnomalies = anomalies.reverse().slice(0, 5);

  if (recentAnomalies.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-rose-400" />
        <h4 className="text-sm font-semibold text-rose-200">Suspicious Historical Patterns Detected</h4>
      </div>
      <ul className="space-y-2 text-xs">
        {recentAnomalies.map((a, i) => (
          <li key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-slate-300">
            <span className="font-mono text-[10px] text-slate-500">{format(parseISO(a.time), "dd MMM HH:mm:ss")}</span>
            <span className={a.severity === "high" ? "text-rose-400" : "text-amber-400"}>{a.msg}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
