"use client";

import React, { useState, useEffect } from "react";
import { CampaignEventType } from "@senlo/core";
import { Badge, Input } from "@senlo/ui";
import { useQuery } from "@tanstack/react-query";
import { getPaginatedCampaignEvents } from "../actions";
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

interface DeliveryLogsProps {
  campaignId: number;
}

const eventIcons: Record<string, React.ReactNode> = {
  SENT: <Send size={16} className="text-zinc-500" />,
  DELIVERED: <CheckCircle2 size={16} className="text-green-500" />,
  OPEN: <Eye size={16} className="text-blue-500" />,
  CLICK: <MousePointer2 size={16} className="text-purple-500" />,
  BOUNCE: <AlertCircle size={16} className="text-red-500" />,
  SPAM_REPORT: <AlertCircle size={16} className="text-orange-500" />,
  UNSUBSCRIBE: <UserMinus size={16} className="text-zinc-400" />,
  FAILED: <AlertCircle size={16} className="text-red-500" />,
};

const EVENT_TYPES: (CampaignEventType | "ALL")[] = [
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

export function DeliveryLogs({ campaignId }: DeliveryLogsProps) {
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const ITEMS_PER_PAGE = 30;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      "campaign-events",
      campaignId,
      currentPage,
      selectedType,
      debouncedSearch,
    ],
    queryFn: async () => {
      const result = await getPaginatedCampaignEvents(
        campaignId,
        currentPage,
        ITEMS_PER_PAGE,
        selectedType === "ALL" ? undefined : selectedType,
        debouncedSearch || undefined,
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (isError) {
    return (
      <div className="py-12 text-center bg-red-50 rounded-xl border border-dashed border-red-200">
        <AlertCircle size={32} className="mx-auto text-red-500 mb-2" />
        <p className="text-sm text-red-600 font-medium">Failed to load logs</p>
        <p className="text-xs text-red-500 mt-1">{(error as Error).message}</p>
      </div>
    );
  }

  const events = data?.events || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, total);

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
              value={selectedType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="px-3 py-2 border border-zinc-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type === "ALL" ? "All Events" : type.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        {total > 0 && (
          <div className="text-sm text-zinc-500 whitespace-nowrap">
            Showing{" "}
            <span className="font-medium text-zinc-900">{startIndex + 1}</span>-
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
              {search || selectedType !== "ALL"
                ? "No logs match your filters."
                : "No delivery logs recorded yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-zinc-100 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50/50 border-b border-zinc-100">
                  <th className="text-left py-3 px-4 font-medium text-zinc-600">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-zinc-600">
                    Email
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-zinc-600">
                    Time
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-zinc-600">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {events.map((event) => (
                  <tr
                    key={event.id}
                    className="hover:bg-zinc-50/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {eventIcons[event.type] || <Clock size={16} />}
                        <span className="font-medium text-zinc-700 text-xs uppercase tracking-wider">
                          {event.type.replace("_", " ")}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-zinc-900">
                      {event.email}
                    </td>
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

      {total > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-center gap-2 pt-4 border-t border-zinc-100">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
            className="flex items-center gap-1 px-3 py-2 text-sm border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
            Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // Simple pagination logic: show first, last, and around current
              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    disabled={isLoading}
                    className={`px-3 py-2 text-sm border rounded-md transition-colors ${
                      page === currentPage
                        ? "bg-zinc-900 text-white border-zinc-900"
                        : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    {page}
                  </button>
                );
              }

              if (page === currentPage - 2 || page === currentPage + 2) {
                return (
                  <span key={page} className="px-2 text-zinc-400">
                    ...
                  </span>
                );
              }

              return null;
            })}
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
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
