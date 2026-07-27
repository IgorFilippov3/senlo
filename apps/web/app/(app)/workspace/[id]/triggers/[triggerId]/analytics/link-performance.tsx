"use client";

import React from "react";
import { LinkStat } from "@senlo/core";
import { ExternalLink, MousePointer2 } from "lucide-react";

interface LinkPerformanceProps {
  data: LinkStat[] | undefined;
  isLoading: boolean;
  totalDelivered: number;
}

export function LinkPerformance({
  data,
  isLoading,
  totalDelivered,
}: LinkPerformanceProps) {
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
            <th className="text-left py-3 px-4 font-medium text-zinc-600">
              Link URL
            </th>
            <th className="text-right py-3 px-4 font-medium text-zinc-600">
              Total Clicks
            </th>
            <th className="text-right py-3 px-4 font-medium text-zinc-600">
              Unique Clicks
            </th>
            <th className="text-right py-3 px-4 font-medium text-zinc-600">
              CTR
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50">
          {data.map((stat, i) => {
            const ctr =
              totalDelivered > 0
                ? ((stat.uniqueClicks / totalDelivered) * 100).toFixed(1)
                : "0.0";

            return (
              <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2 max-w-md">
                    <ExternalLink
                      size={14}
                      className="text-zinc-400 shrink-0"
                    />
                    <span
                      className="text-zinc-900 font-medium truncate"
                      title={stat.url}
                    >
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
