"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";

export type TimeSeriesInterval = "hour" | "day";

export interface TimeSeriesLine<T> {
  key: keyof T & string;
  label: string;
  /** Any CSS colour; used for the line, the tooltip dot and the legend. */
  color: string;
}

export interface TimeSeriesChartProps<T extends { timestamp: string }> {
  data: T[];
  lines: TimeSeriesLine<T>[];
  /** Hourly points get times on the axis and in the tooltip. */
  interval?: TimeSeriesInterval;
  /** Recharts' own legend above the plot; off when the caller draws one. */
  showLegend?: boolean;
  strokeWidth?: number;
}

interface TooltipEntry {
  dataKey?: unknown;
  value?: unknown;
}

/**
 * Line chart over ISO timestamps. Fills its parent, so the caller sets the
 * height. Used by the dashboard's sends chart and a trigger's analytics.
 */
export function TimeSeriesChart<T extends { timestamp: string }>({
  data,
  lines,
  interval = "day",
  showLegend = false,
  strokeWidth = 2,
}: TimeSeriesChartProps<T>) {
  const renderTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: ReadonlyArray<TooltipEntry>;
    label?: unknown;
  }) => {
    if (!active || !payload?.length || typeof label !== "string") return null;
    const date = parseISO(label);
    return (
      <div className="bg-white p-3 border border-zinc-200 shadow-lg rounded-lg text-xs">
        <p className="font-bold mb-2 text-zinc-900">
          {interval === "hour"
            ? format(date, "MMM dd, HH:mm")
            : format(date, "MMMM dd, yyyy")}
        </p>
        <div className="space-y-1">
          {lines.map((line) => {
            const entry = payload.find((p) => p.dataKey === line.key);
            return (
              <p key={line.key} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: line.color }}
                />
                <span className="text-zinc-500">{line.label}:</span>
                <span className="font-bold text-zinc-900">
                  {String(entry?.value ?? 0)}
                </span>
              </p>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(t: string) =>
            format(parseISO(t), interval === "hour" ? "HH:mm" : "MMM dd")
          }
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#a1a1aa", fontSize: 10 }}
          minTickGap={30}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#a1a1aa", fontSize: 10 }}
        />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Tooltip content={renderTooltip as any} />
        {showLegend && (
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ paddingBottom: "20px", fontSize: "12px" }}
          />
        )}
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.label}
            stroke={line.color}
            strokeWidth={strokeWidth}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
