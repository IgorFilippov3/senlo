"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  DashboardHeader,
  DashboardStatsGrid,
  EngagementStats,
  ActivityChart,
  EventFeed,
} from "@senlo/features";
import { useDashboardData } from "apps/web/queries/dashboard";
import { DashboardStats, DashboardActivity, DashboardEvent } from "@senlo/core";

export function DashboardClient({ projectId }: { projectId?: number }) {
  const [mounted, setMounted] = useState(false);
  const [days, setDays] = useState(7);

  const { data, isLoading } = useDashboardData(projectId!, days, 8);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dashboardData = data as
    | {
        stats: DashboardStats;
        activity: DashboardActivity[];
        events: DashboardEvent[];
      }
    | undefined;

  if (!mounted || (isLoading && !dashboardData?.stats)) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-zinc-400" size={32} />
      </div>
    );
  }

  const headerActions = (
    <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-lg">
      {[7, 30].map((d) => (
        <button
          key={d}
          onClick={() => setDays(d)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            days === d
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Last {d} days
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <DashboardHeader
        title="System Dashboard"
        description="Overview of your email infrastructure performance."
        actions={headerActions}
      />

      <DashboardStatsGrid stats={dashboardData?.stats} />

      <EngagementStats stats={dashboardData?.stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <ActivityChart data={dashboardData?.activity || []} />
        </div>
        <div>
          <EventFeed events={dashboardData?.events || []} />
        </div>
      </div>
    </div>
  );
}
