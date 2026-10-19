"use client";

import React from "react";
import { TrendingUp } from "lucide-react";
import { Card } from "@senlo/ui";
import type { DashboardActivity } from "@senlo/core";
import { TimeSeriesChart, type TimeSeriesLine } from "../shared";

export interface ActivityChartProps {
  data: DashboardActivity[];
}

const LINES: TimeSeriesLine<DashboardActivity>[] = [
  { key: "success", label: "Sent", color: "#3b82f6" },
  { key: "suppressed", label: "Suppressed", color: "#f43f5e" },
];

export function ActivityChart({ data }: ActivityChartProps) {
  return (
    <Card className="p-6 border-zinc-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-zinc-900 flex items-center gap-2">
          <TrendingUp size={18} className="text-blue-500" />
          Email Activity
        </h3>
        <div className="flex items-center gap-4 text-xs">
          {LINES.map((line) => (
            <div key={line.key} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: line.color }}
              />
              <span className="text-zinc-500">{line.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-[300px] w-full">
        <TimeSeriesChart data={data} lines={LINES} strokeWidth={2.5} />
      </div>
    </Card>
  );
}
