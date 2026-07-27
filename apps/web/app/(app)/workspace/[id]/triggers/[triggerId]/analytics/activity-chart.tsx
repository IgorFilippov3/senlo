/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { TimeSeriesData } from "@senlo/core";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";

interface ActivityChartProps {
  data: TimeSeriesData[] | undefined;
  isLoading: boolean;
  interval: "hour" | "day";
}

// Ручное определение типов для тултипа, так как типы recharts v3 могут конфликтовать
interface CustomTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{
    value: number;
    name: string;
    stroke: string;
    [key: string]: unknown;
  }>;
  label?: string;
  interval: "hour" | "day";
}

const CustomTooltip = ({
  active,
  payload,
  label,
  interval,
}: CustomTooltipProps) => {
  if (active && payload && payload.length && label) {
    const date = parseISO(label);
    return (
      <div className="bg-white p-3 border border-zinc-200 shadow-lg rounded-lg text-xs">
        <p className="font-bold mb-2 text-zinc-900">
          {interval === "hour"
            ? format(date, "MMM dd, HH:mm")
            : format(date, "MMMM dd, yyyy")}
        </p>
        <div className="space-y-1">
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-zinc-500">Opens:</span>
            <span className="font-bold text-zinc-900">
              {payload[0]?.value ?? 0}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-zinc-500">Clicks:</span>
            <span className="font-bold text-zinc-900">
              {payload[1]?.value ?? 0}
            </span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export function ActivityChart({
  data,
  isLoading,
  interval,
}: ActivityChartProps) {
  if (isLoading) {
    return (
      <div className="h-[350px] w-full flex items-center justify-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
        <Loader2 className="animate-spin text-zinc-400" size={32} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[350px] w-full flex items-center justify-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
        <p className="text-sm text-zinc-500">
          No activity data for this period.
        </p>
      </div>
    );
  }

  const formatXAxis = (tickItem: string) => {
    const date = parseISO(tickItem);
    return interval === "hour" ? format(date, "HH:mm") : format(date, "MMM dd");
  };

  return (
    <div className="h-[350px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#f0f0f0"
          />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatXAxis}
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
          <Tooltip
            content={(props: any) => (
              <CustomTooltip {...props} interval={interval} />
            )}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ paddingBottom: "20px", fontSize: "12px" }}
          />
          <Line
            type="monotone"
            dataKey="opens"
            name="Opens"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="clicks"
            name="Clicks"
            stroke="#a855f7"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
