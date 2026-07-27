"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCampaignLinkStats,
  getCampaignTimeSeriesStats,
} from "../../actions";
import { queryKeys } from "apps/web/providers/query-keys";
import { ActivityChart } from "./activity-chart";
import { LinkPerformance } from "./link-performance";
import { AnalyticsFilters, AnalyticsInterval } from "./analytics-filters";
import { Card } from "@senlo/ui";
import { BarChart3, MousePointer2 } from "lucide-react";

interface AnalyticsTabProps {
  campaignId: number;
  totalDelivered: number;
}

export function AnalyticsTab({
  campaignId,
  totalDelivered,
}: AnalyticsTabProps) {
  const [days, setDays] = useState(7);
  const [interval, setInterval] = useState<AnalyticsInterval>("day");

  const { data: timeSeries, isLoading: isTimeLoading } = useQuery({
    queryKey: queryKeys.analytics.timeSeries(campaignId, { days, interval }),
    queryFn: async () => {
      const result = await getCampaignTimeSeriesStats(campaignId, {
        days,
        interval,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });

  const { data: linkStats, isLoading: isLinksLoading } = useQuery({
    queryKey: queryKeys.analytics.links(campaignId),
    queryFn: async () => {
      const result = await getCampaignLinkStats(campaignId);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-zinc-900">
            <BarChart3 size={20} className="text-zinc-400" />
            Activity Over Time
          </h3>
          <AnalyticsFilters
            days={days}
            interval={interval}
            onDaysChange={setDays}
            onIntervalChange={setInterval}
          />
        </div>
        <ActivityChart
          data={timeSeries}
          isLoading={isTimeLoading}
          interval={interval}
        />
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-zinc-900 mb-6">
          <MousePointer2 size={20} className="text-zinc-400" />
          Link Performance
        </h3>
        <LinkPerformance
          data={linkStats}
          isLoading={isLinksLoading}
          totalDelivered={totalDelivered}
        />
      </Card>
    </div>
  );
}
