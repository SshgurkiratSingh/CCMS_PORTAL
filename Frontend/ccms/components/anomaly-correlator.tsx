"use client";

import React, { useMemo } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Scatter,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Card } from "@heroui/react";
import { TelemetryPoint } from "@/lib/api/types";

interface AnomalyCorrelatorProps {
  data: TelemetryPoint[];
  dataKey: keyof TelemetryPoint;
  title: string;
  unit: string;
  color?: string;
  windowSize?: number;
  sensitivity?: number;
}

export function AnomalyCorrelator({
  data,
  dataKey,
  title,
  unit,
  color = "#8b5cf6",
  windowSize = 5,
  sensitivity = 2.5,
}: AnomalyCorrelatorProps) {
  const analyzedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const series = data.map((d) => Number(d[dataKey]) || 0);

    const sum = series.reduce((a, b) => a + b, 0);
    const mean = sum / (series.length || 1);

    const variance =
      series.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
      (series.length || 1);
    const stdDev = Math.sqrt(variance);

    return data.map((point, i) => {
      const val = Number(point[dataKey]) || 0;

      let ma = val;
      if (i >= windowSize - 1) {
        let maSum = 0;
        for (let j = 0; j < windowSize; j++) {
          maSum += Number(data[i - j][dataKey]) || 0;
        }
        ma = maSum / windowSize;
      }

      const dev = Math.abs(val - ma);
      const isAnomaly = stdDev > 0 && dev > stdDev * sensitivity;

      return {
        ...point,
        originalValue: val,
        movingAverage: ma,
        anomalyValue: isAnomaly ? val : null,
      };
    });
  }, [data, dataKey, windowSize, sensitivity]);

  const anomaliesCount = analyzedData.filter(d => d.anomalyValue !== null).length;

  return (
    <Card className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-4 flex flex-col">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800/60">
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {title} - Anomaly Correlator
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Z-Score Scanning • Sens: {sensitivity}σ • Detected: <span className={anomaliesCount > 0 ? "text-rose-400 font-bold" : "text-emerald-400"}>{anomaliesCount}</span>
          </p>
        </div>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={analyzedData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="timestampUtc"
              tickFormatter={(t) => {
                try {
                  return format(parseISO(t), "HH:mm");
                } catch {
                  return t;
                }
              }}
              stroke="#475569"
              fontSize={10}
              minTickGap={24}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#475569"
              fontSize={10}
              tickFormatter={(t) => Number(t).toFixed(0)}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderColor: "#1e293b",
                borderRadius: "8px",
                fontSize: "11px",
              }}
              labelFormatter={(l) => {
                try {
                  return format(parseISO(l as string), "HH:mm:ss");
                } catch {
                  return l;
                }
              }}
            />
            <Line
              type="monotone"
              dataKey="originalValue"
              name={title}
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="movingAverage"
              name="Moving Avg"
              stroke="#64748b"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
            <Scatter
              dataKey="anomalyValue"
              name="Anomaly"
              fill="#ef4444"
              cursor="crosshair"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
