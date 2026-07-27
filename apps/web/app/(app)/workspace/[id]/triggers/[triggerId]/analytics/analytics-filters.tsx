"use client";

import React from "react";

export type AnalyticsInterval = "hour" | "day";

interface AnalyticsFiltersProps {
  days: number;
  interval: AnalyticsInterval;
  onDaysChange: (days: number) => void;
  onIntervalChange: (interval: AnalyticsInterval) => void;
}

const PERIODS = [
  { label: "24h", days: 1, interval: "hour" as const },
  { label: "7d", days: 7, interval: "day" as const },
  { label: "30d", days: 30, interval: "day" as const },
  { label: "90d", days: 90, interval: "day" as const },
];

export function AnalyticsFilters({
  days,
  interval,
  onDaysChange,
  onIntervalChange,
}: AnalyticsFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center bg-zinc-100 p-1 rounded-lg">
        {PERIODS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              onDaysChange(p.days);
              onIntervalChange(p.interval);
            }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              days === p.days
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="h-4 w-[1px] bg-zinc-200 mx-2" />

      <div className="flex items-center bg-zinc-100 p-1 rounded-lg">
        {[
          { label: "Hourly", value: "hour" as const },
          { label: "Daily", value: "day" as const },
        ].map((i) => (
          <button
            key={i.value}
            onClick={() => onIntervalChange(i.value)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              interval === i.value
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {i.label}
          </button>
        ))}
      </div>
    </div>
  );
}
