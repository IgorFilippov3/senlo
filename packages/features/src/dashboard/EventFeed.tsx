"use client";

import React from "react";
import { format } from "date-fns";
import {
  History,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { Card } from "@senlo/ui";
import type { DashboardEvent } from "@senlo/core";

export interface EventFeedProps {
  events: DashboardEvent[];
}

export function EventFeed({ events }: EventFeedProps) {
  return (
    <Card className="p-6 border-zinc-200 h-full">
      <h3 className="font-bold text-zinc-900 flex items-center gap-2 mb-6">
        <History size={18} className="text-zinc-400" />
        Live Event Feed
      </h3>
      <div className="space-y-6">
        {events.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-8">
            No recent activity detected.
          </p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="flex gap-3 relative">
              <div className="mt-1 shrink-0">
                {event.type === "SUPPRESSION_ADDED" ? (
                  <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
                    <ShieldCheck size={14} />
                  </div>
                ) : event.type === "BOUNCE" ||
                  event.type === "SPAM" ||
                  event.type === "FAILED" ? (
                  <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100">
                    <AlertCircle size={14} />
                  </div>
                ) : event.type === "CAMPAIGN_COMPLETED" ? (
                  <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600 border border-green-100">
                    <CheckCircle2 size={14} />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                    <Zap size={14} />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 truncate">
                  {event.title}
                </p>
                <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">
                  {event.description}
                </p>
                <p className="text-[10px] text-zinc-400 mt-1 font-medium uppercase tracking-wider">
                  {format(new Date(event.occurredAt), "HH:mm · MMM dd")}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
