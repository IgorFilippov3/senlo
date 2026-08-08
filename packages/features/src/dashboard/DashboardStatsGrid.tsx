"use client";

import React from "react";
import { Mail, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { StatCard } from "./StatCard";
import { DashboardStats } from "@senlo/core";

export interface DashboardStatsGridProps {
  stats?: DashboardStats;
}

export function DashboardStatsGrid({ stats }: DashboardStatsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Sent"
        value={stats?.totalSent || 0}
        icon={Mail}
        color="blue"
        description="Emails attempted across all projects"
      />
      <StatCard
        title="Delivered"
        value={stats?.delivered || 0}
        icon={CheckCircle2}
        color="green"
        description="Successful deliveries"
        trend={`${stats?.totalSent ? ((stats.delivered / stats.totalSent) * 100).toFixed(1) : 0}% rate`}
      />
      <StatCard
        title="Bounced"
        value={stats?.bounced || 0}
        icon={AlertCircle}
        color="rose"
        description="Returned or rejected emails"
      />
      <StatCard
        title="Saved Sends"
        value={stats?.savedSends || 0}
        icon={ShieldCheck}
        color="amber"
        description="Intercepted by reputation protection"
        trend="Protected"
      />
    </div>
  );
}
