"use client";

import React from "react";
import type { LinkStat, TimeSeriesData } from "@senlo/core";
import { Card } from "@senlo/ui";
import { BarChart3, ExternalLink, Loader2, MousePointer2 } from "lucide-react";
import {
  TimeSeriesChart,
  type TimeSeriesInterval,
  type TimeSeriesLine,
} from "../shared";

export interface AnalyticsPeriod {
  days: number;
  interval: TimeSeriesInterval;
}

export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriod = { days: 7, interval: "day" };

const PERIODS: (AnalyticsPeriod & { label: string })[] = [
  { label: "24h", days: 1, interval: "hour" },
  { label: "7d", days: 7, interval: "day" },
  { label: "30d", days: 30, interval: "day" },
  { label: "90d", days: 90, interval: "day" },
];

const INTERVALS: { label: string; value: TimeSeriesInterval }[] = [
  { label: "Hourly", value: "hour" },
  { label: "Daily", value: "day" },
];

const LINES: TimeSeriesLine<TimeSeriesData>[] = [
  { key: "opens", label: "Opens", color: "#3b82f6" },
  { key: "clicks", label: "Clicks", color: "#a855f7" },
];

export interface AnalyticsFiltersProps {
  period: AnalyticsPeriod;
  onPeriodChange: (period: AnalyticsPeriod) => void;
}

export function AnalyticsFilters({ period, onPeriodChange }: AnalyticsFiltersProps) {
  const segment = (active: boolean) =>
    `px-3 py-1 text-xs font-medium rounded-md transition-all ${
      active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
    }`;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center bg-zinc-100 p-1 rounded-lg">
        {PERIODS.map(({ label, days, interval }) => (
          <button
            key={label}
            onClick={() => onPeriodChange({ days, interval })}
            className={segment(period.days === days)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="h-4 w-[1px] bg-zinc-200 mx-2" />

      <div className="flex items-center bg-zinc-100 p-1 rounded-lg">
        {INTERVALS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => onPeriodChange({ ...period, interval: value })}
            className={segment(period.interval === value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export interface LinkPerformanceProps {
  data: LinkStat[] | undefined;
  isLoading: boolean;
  totalDelivered: number;
}

export function LinkPerformance({ data, isLoading, totalDelivered }: LinkPerformanceProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 w-full bg-zinc-50 animate-pulse rounded-lg border border-zinc-100"
          />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="py-12 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
        <MousePointer2 size={32} className="mx-auto text-zinc-300 mb-2" />
        <p className="text-sm text-zinc-500">No link clicks recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-zinc-100 rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50/50 border-b border-zinc-100">
            <th className="text-left py-3 px-4 font-medium text-zinc-600">Link URL</th>
            <th className="text-right py-3 px-4 font-medium text-zinc-600">Total Clicks</th>
            <th className="text-right py-3 px-4 font-medium text-zinc-600">Unique Clicks</th>
            <th className="text-right py-3 px-4 font-medium text-zinc-600">CTR</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50">
          {data.map((stat) => {
            const ctr =
              totalDelivered > 0
                ? ((stat.uniqueClicks / totalDelivered) * 100).toFixed(1)
                : "0.0";

            return (
              <tr key={stat.url} className="hover:bg-zinc-50/50 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2 max-w-md">
                    <ExternalLink size={14} className="text-zinc-400 shrink-0" />
                    <span className="text-zinc-900 font-medium truncate" title={stat.url}>
                      {stat.url}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-right text-zinc-600 font-mono">
                  {stat.totalClicks}
                </td>
                <td className="py-3 px-4 text-right text-zinc-900 font-bold font-mono">
                  {stat.uniqueClicks}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                    {ctr}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export interface TriggerAnalyticsProps {
  period: AnalyticsPeriod;
  onPeriodChange: (period: AnalyticsPeriod) => void;
  timeSeries: TimeSeriesData[] | undefined;
  isTimeSeriesLoading: boolean;
  linkStats: LinkStat[] | undefined;
  isLinkStatsLoading: boolean;
  /** Denominator for link CTR. */
  totalDelivered: number;
}

export function TriggerAnalytics({
  period,
  onPeriodChange,
  timeSeries,
  isTimeSeriesLoading,
  linkStats,
  isLinkStatsLoading,
  totalDelivered,
}: TriggerAnalyticsProps) {
  const placeholder = "h-[350px] w-full flex items-center justify-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200";

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-zinc-900">
            <BarChart3 size={20} className="text-zinc-400" />
            Activity Over Time
          </h3>
          <AnalyticsFilters period={period} onPeriodChange={onPeriodChange} />
        </div>
        {isTimeSeriesLoading ? (
          <div className={placeholder}>
            <Loader2 className="animate-spin text-zinc-400" size={32} />
          </div>
        ) : !timeSeries || timeSeries.length === 0 ? (
          <div className={placeholder}>
            <p className="text-sm text-zinc-500">No activity data for this period.</p>
          </div>
        ) : (
          <div className="h-[350px] w-full mt-4">
            <TimeSeriesChart
              data={timeSeries}
              lines={LINES}
              interval={period.interval}
              showLegend
            />
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-zinc-900 mb-6">
          <MousePointer2 size={20} className="text-zinc-400" />
          Link Performance
        </h3>
        <LinkPerformance
          data={linkStats}
          isLoading={isLinkStatsLoading}
          totalDelivered={totalDelivered}
        />
      </Card>
    </div>
  );
}
