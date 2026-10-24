// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useEffect, useState } from "react";
import { useDashboardData } from "../data/dashboard";
import { LoadingState } from "../shared/Loading";
import { useCurrentWorkspace } from "../workspaces/WorkspaceScope";
import { ActivityChart } from "./ActivityChart";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardStatsGrid } from "./DashboardStatsGrid";
import { EngagementStats } from "./EngagementStats";
import { EventFeed } from "./EventFeed";

const PERIODS = [7, 30];
const EVENT_LIMIT = 8;

/** The workspace's dashboard: sends, engagement, activity, recent events. */
export function DashboardScreen() {
  const workspace = useCurrentWorkspace();
  const [mounted, setMounted] = useState(false);
  const [days, setDays] = useState(7);
  const { data, isLoading } = useDashboardData(workspace.id, days, EVENT_LIMIT);

  // The chart measures the page; rendered on the server it would not match.
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {!mounted || isLoading ? (
        <LoadingState className="h-[60vh]" />
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
          <DashboardHeader
            title="System Dashboard"
            description="Overview of your email infrastructure performance."
            actions={
              <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-lg">
                {PERIODS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      days === d ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    Last {d} days
                  </button>
                ))}
              </div>
            }
          />

          <DashboardStatsGrid stats={data?.stats} />

          <EngagementStats stats={data?.stats} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <ActivityChart data={data?.activity || []} />
            </div>
            <div>
              <EventFeed events={data?.events || []} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
