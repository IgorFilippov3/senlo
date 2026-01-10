"use client";

import React, { useState, useEffect } from "react";
import { CampaignEvent, CampaignEventType } from "@senlo/core";
import { Badge } from "@senlo/ui";
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
} from "lucide-react";

interface CampaignTimelineProps {
  events: CampaignEvent[];
}

const eventIcons: Record<string, React.ReactNode> = {
  SENT: <Send size={16} className="text-zinc-500" />,
  DELIVERED: <CheckCircle2 size={16} className="text-green-500" />,
  OPEN: <Eye size={16} className="text-blue-500" />,
  CLICK: <MousePointer2 size={16} className="text-purple-500" />,
  BOUNCE: <AlertCircle size={16} className="text-red-500" />,
  SPAM_REPORT: <AlertCircle size={16} className="text-orange-500" />,
  UNSUBSCRIBE: <UserMinus size={16} className="text-zinc-400" />,
};

export function CampaignTimeline({ events }: CampaignTimelineProps) {
  const eventTypes: CampaignEventType[] = Array.from(
    new Set(events.map((e) => e.type))
  ).sort();
  const [selectedType, setSelectedType] = useState<CampaignEventType>(
    eventTypes[0] as CampaignEventType
  );
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    if (
      (!selectedType || !eventTypes.includes(selectedType)) &&
      eventTypes.length > 0
    ) {
      setSelectedType(eventTypes[0]);
    }
  }, [eventTypes, selectedType]);

  const ITEMS_PER_PAGE = 30;

  if (events.length === 0) {
    return (
      <div className="py-12 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
        <Clock size={32} className="mx-auto text-zinc-300 mb-2" />
        <p className="text-sm text-zinc-500">
          No events recorded yet. Send your campaign to see activity.
        </p>
      </div>
    );
  }

  const filteredEvents = events.filter((e) => e.type === selectedType);

  const totalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedEvents = filteredEvents.slice(startIndex, endIndex);

  const groupedEvents = paginatedEvents.reduce((acc, event) => {
    if (!acc[event.type]) {
      acc[event.type] = [];
    }
    acc[event.type].push(event);
    return acc;
  }, {} as Record<string, CampaignEvent[]>);

  const sortedTypes = Object.keys(groupedEvents).sort();

  const handleTypeChange = (type: string) => {
    setSelectedType(type as CampaignEventType);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-zinc-400" />
          <select
            value={selectedType}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="px-3 py-2 border border-zinc-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        {filteredEvents.length > ITEMS_PER_PAGE && (
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <span>
              Showing {startIndex + 1}-
              {Math.min(endIndex, filteredEvents.length)} of{" "}
              {filteredEvents.length}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {sortedTypes.map((eventType) => {
          const typeEvents = groupedEvents[eventType];
          return (
            <div key={eventType} className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  {eventIcons[eventType] || <Clock size={16} />}
                  <span className="font-medium text-sm">
                    {eventType.replace("_", " ")} ({typeEvents.length})
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="text-left py-2 px-3 font-medium text-zinc-600">
                        Email
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-zinc-600">
                        Time
                      </th>
                      {eventType === "CLICK" && (
                        <th className="text-left py-2 px-3 font-medium text-zinc-600">
                          Link
                        </th>
                      )}
                      <th className="text-left py-2 px-3 font-medium text-zinc-600">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {typeEvents.map((event) => (
                      <tr
                        key={event.id}
                        className="border-b border-zinc-50 hover:bg-zinc-25"
                      >
                        <td className="py-2 px-3 font-medium text-zinc-900">
                          {event.email}
                        </td>
                        <td className="py-2 px-3 text-zinc-500">
                          {event.occurredAt instanceof Date
                            ? event.occurredAt.toLocaleString("en-GB")
                            : String(event.occurredAt)}
                        </td>
                        {eventType === "CLICK" && (
                          <td className="py-2 px-3">
                            {event.linkUrl && (
                              <span className="text-blue-600 text-xs truncate block max-w-32">
                                {event.linkUrl}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="py-2 px-3">
                          {event.metadata &&
                            Object.keys(event.metadata).length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(event.metadata).map(
                                  ([key, value]) => (
                                    <Badge
                                      key={key}
                                      variant="secondary"
                                      className="text-[10px] py-0 px-1 font-normal"
                                    >
                                      {key}: {String(value)}
                                    </Badge>
                                  )
                                )}
                              </div>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {filteredEvents.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-center gap-2 pt-4 border-t border-zinc-100">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-2 text-sm border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            <ChevronLeft size={16} />
            Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              if (totalPages <= 7) {
                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-2 text-sm border rounded-md ${
                      page === currentPage
                        ? "bg-blue-500 text-white border-blue-500"
                        : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    {page}
                  </button>
                );
              }

              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-2 text-sm border rounded-md ${
                      page === currentPage
                        ? "bg-blue-500 text-white border-blue-500"
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
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-3 py-2 text-sm border border-zinc-200 rounded-md hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
