"use client";

import React from "react";
import { Eye, MousePointer2 } from "lucide-react";
import { Card } from "@senlo/ui";
import type { DashboardStats } from "@senlo/core";

export interface EngagementStatsProps {
  stats?: DashboardStats;
}

export function EngagementStats({ stats }: EngagementStatsProps) {
  const openRate = stats?.totalSent
    ? ((stats.opened / stats.totalSent) * 100).toFixed(1)
    : "0.0";
  const clickRate = stats?.totalSent
    ? ((stats.clicked / stats.totalSent) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-4 border-zinc-200 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
          <Eye size={24} />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500">Average Open Rate</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-900">
              {openRate}%
            </span>
            <span className="text-xs text-zinc-400">
              {stats?.opened} unique opens
            </span>
          </div>
        </div>
      </Card>
      <Card className="p-4 border-zinc-200 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
          <MousePointer2 size={24} />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500">
            Average Click Rate
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-900">
              {clickRate}%
            </span>
            <span className="text-xs text-zinc-400">
              {stats?.clicked} unique clicks
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
