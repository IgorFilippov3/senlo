// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { Card } from "@senlo/ui";
import { Archive } from "lucide-react";

export interface LogRetentionCardProps {
  /** Days each email's details are kept; `null` is forever, `undefined` while loading. */
  days: number | null | undefined;
  /** The host's line under the explanation: managed links to its plans, self-hosted names the setting. */
  note?: React.ReactNode;
}

/** How long the workspace keeps each email's details, and that statistics stay regardless. */
export function LogRetentionCard({ days, note }: LogRetentionCardProps) {
  return (
    <Card className="p-6 border-zinc-200 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-zinc-100 rounded-lg text-zinc-500 shrink-0">
          <Archive size={20} />
        </div>
        <div className="space-y-2 text-sm text-zinc-600">
          <h3 className="text-lg font-medium text-zinc-900">Data retention</h3>
          {days === undefined ? (
            <div className="h-5 w-64 bg-zinc-100 rounded animate-pulse" />
          ) : (
            <p>
              Email details are kept{" "}
              <span className="font-semibold text-zinc-900">
                {days === null ? "indefinitely" : `for ${days} ${days === 1 ? "day" : "days"}`}
              </span>
              : each send's log entry with the data it was sent with, and the raw delivery, open and
              click events.{days === null ? "" : " Older ones are deleted daily."}
            </p>
          )}
          <p>
            Statistics are kept for good: sends, deliveries, bounces, opens and clicks per day stay on the
            dashboard and in each trigger's analytics after the details are gone. Clicks per link and the
            hourly chart are counted from the details, so they cover the kept days only.
          </p>
          {note ? <div className="pt-1">{note}</div> : null}
        </div>
      </div>
    </Card>
  );
}
