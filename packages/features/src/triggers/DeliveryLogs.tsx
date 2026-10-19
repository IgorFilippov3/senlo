"use client";

import React, { useEffect, useRef, useState } from "react";
import type { CampaignEvent, CampaignEventType } from "@senlo/core";
import { Badge, Input } from "@senlo/ui";
import {
  Send,
  Eye,
  MousePointer2,
  AlertCircle,
  UserMinus,
  CheckCircle2,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

export type DeliveryLogFilter = CampaignEventType | "ALL";

export const DELIVERY_LOG_FILTERS: DeliveryLogFilter[] = [
  "ALL",
  "SENT",
  "DELIVERED",
  "OPEN",
  "CLICK",
  "BOUNCE",
  "SPAM_REPORT",
  "UNSUBSCRIBE",
  "FAILED",
];

const eventIcons: Partial<Record<CampaignEventType, React.ReactNode>> = {
  SENT: <Send size={16} className="text-zinc-500" />,
  DELIVERED: <CheckCircle2 size={16} className="text-green-500" />,
  OPEN: <Eye size={16} className="text-blue-500" />,
  CLICK: <MousePointer2 size={16} className="text-purple-500" />,
  BOUNCE: <AlertCircle size={16} className="text-red-500" />,
  SPAM_REPORT: <AlertCircle size={16} className="text-orange-500" />,
  UNSUBSCRIBE: <UserMinus size={16} className="text-zinc-400" />,
  FAILED: <AlertCircle size={16} className="text-red-500" />,
};

const SEARCH_DEBOUNCE_MS = 500;

export interface DeliveryLogsProps {
  events: CampaignEvent[];
  total: number;
  isLoading: boolean;
  /** Set when loading failed; replaces the table. */
  error?: string | null;
  page: number;
  pageSize: number;
  filter: DeliveryLogFilter;
  onPageChange: (page: number) => void;
  onFilterChange: (filter: DeliveryLogFilter) => void;
  /** Called with the search text once typing pauses. */
  onSearchChange: (search: string) => void;
}

/**
 * A trigger's event log: search by address, filter by event type, paged.
 * Controlled: the caller loads the page and resets it when filters change.
 */
export function DeliveryLogs({
  events,
  total,
  isLoading,
  error,
  page,
  pageSize,
  filter,
  onPageChange,
  onFilterChange,
  onSearchChange,
}: DeliveryLogsProps) {
  const [search, setSearch] = useState("");
  const emitted = useRef("");

  useEffect(() => {
    if (search === emitted.current) return;
    const timer = setTimeout(() => {
      emitted.current = search;
      onSearchChange(search);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, onSearchChange]);

  if (error) {
    return (
      <div className="py-12 text-center bg-red-50 rounded-xl border border-dashed border-red-200">
        <AlertCircle size={32} className="mx-auto text-red-500 mb-2" />
        <p className="text-sm text-red-600 font-medium">Failed to load logs</p>
        <p className="text-xs text-red-500 mt-1">{error}</p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  const label = (type: string) => type.replace("_", " ");

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Search by email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-zinc-400" />
            <select
              value={filter}
              onChange={(e) => onFilterChange(e.target.value as DeliveryLogFilter)}
              className="px-3 py-2 border border-zinc-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {DELIVERY_LOG_FILTERS.map((type) => (
                <option key={type} value={type}>
                  {type === "ALL" ? "All Events" : label(type)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {total > 0 && (
          <div className="text-sm text-zinc-500 whitespace-nowrap">
            Showing <span className="font-medium text-zinc-900">{startIndex + 1}</span>-
            <span className="font-medium text-zinc-900">{endIndex}</span> of{" "}
            <span className="font-medium text-zinc-900">{total}</span>
          </div>
        )}
      </div>

      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-lg">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        )}

        {total === 0 && !isLoading ? (
          <div className="py-12 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
            <Clock size={32} className="mx-auto text-zinc-300 mb-2" />
            <p className="text-sm text-zinc-500">
              {search || filter !== "ALL"
                ? "No logs match your filters."
                : "No delivery logs recorded yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-zinc-100 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50/50 border-b border-zinc-100">
                  <th className="text-left py-3 px-4 font-medium text-zinc-600">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-zinc-600">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-zinc-600">Time</th>
                  <th className="text-left py-3 px-4 font-medium text-zinc-600">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {eventIcons[event.type] ?? <Clock size={16} />}
                        <span className="font-medium text-zinc-700 text-xs uppercase tracking-wider">
                          {label(event.type)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-zinc-900">{event.email}</td>
                    <td className="py-3 px-4 text-zinc-500 whitespace-nowrap">
                      {new Date(event.occurredAt).toLocaleString("en-GB")}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {event.linkUrl && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] py-0 px-1 font-normal bg-blue-50 text-blue-700 border-blue-100"
                          >
                            Link: {event.linkUrl}
                          </Badge>
                        )}
                        {event.metadata &&
                          Object.entries(event.metadata).map(([key, value]) => (
                            <Badge
                              key={key}
                              variant="secondary"
                              className="text-[10px] py-0 px-1 font-normal"
                            >
                              {key}: {String(value)}
                            </Badge>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-center gap-2 pt-4 border-t border-zinc-100">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1 || isLoading}
            className="flex items-center gap-1 px-3 py-2 text-sm border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
            Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              // First, last, and the pages around the current one.
              if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
                return (
                  <button
                    key={p}
                    onClick={() => onPageChange(p)}
                    disabled={isLoading}
                    className={`px-3 py-2 text-sm border rounded-md transition-colors ${
                      p === page
                        ? "bg-zinc-900 text-white border-zinc-900"
                        : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    {p}
                  </button>
                );
              }
              if (p === page - 2 || p === page + 2) {
                return (
                  <span key={p} className="px-2 text-zinc-400">
                    ...
                  </span>
                );
              }
              return null;
            })}
          </div>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages || isLoading}
            className="flex items-center gap-1 px-3 py-2 text-sm border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
