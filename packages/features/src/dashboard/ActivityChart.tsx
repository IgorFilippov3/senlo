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
} from "recharts";
import { format, parseISO } from "date-fns";
import { TrendingUp } from "lucide-react";
import { Card } from "@senlo/ui";
import type { DashboardActivity } from "@senlo/core";

export interface ActivityChartProps {
  data: DashboardActivity[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length && label) {
    const date = parseISO(label);
    return (
      <div className="bg-white p-3 border border-zinc-200 shadow-lg rounded-lg text-xs">
        <p className="font-bold mb-2 text-zinc-900">
          {format(date, "MMMM dd, yyyy")}
        </p>
        <div className="space-y-1">
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-zinc-500">Sent:</span>
            <span className="font-bold text-zinc-900">
              {payload[0]?.value ?? 0}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-zinc-500">Suppressed:</span>
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

export function ActivityChart({ data }: ActivityChartProps) {
  return (
    <Card className="p-6 border-zinc-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-zinc-900 flex items-center gap-2">
          <TrendingUp size={18} className="text-blue-500" />
          Email Activity
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-zinc-500">Sent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-zinc-500">Suppressed</span>
          </div>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#f0f0f0"
            />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(t) => format(parseISO(t), "MMM dd")}
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
            <Tooltip content={CustomTooltip} />
            <Line
              type="monotone"
              dataKey="success"
              name="Sent"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="suppressed"
              name="Suppressed"
              stroke="#f43f5e"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
