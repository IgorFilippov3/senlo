// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useEffect, useState } from "react";
import { Button, Card, Input } from "@senlo/ui";
import { Gauge } from "lucide-react";
import { useAutomationSettings, useUpdateAutomationSettings } from "../data/workspaces";

export interface FrequencyCapCardProps {
  projectId: number;
}

/**
 * The workspace's frequency cap: at most N automation emails per contact in
 * D days. An email step over it is skipped and the run goes on. Emails sent
 * through the API and test runs are not capped.
 */
export function FrequencyCapCard({ projectId }: FrequencyCapCardProps) {
  const settings = useAutomationSettings(projectId);
  const update = useUpdateAutomationSettings(projectId);
  const cap = settings.data?.frequencyCap;

  const [enabled, setEnabled] = useState(false);
  const [emails, setEmails] = useState("3");
  const [days, setDays] = useState("7");

  // The stored values, once loaded (and after a save).
  useEffect(() => {
    if (!settings.data) return;
    setEnabled(!!cap);
    if (cap) {
      setEmails(String(cap.emails));
      setDays(String(cap.days));
    }
  }, [settings.data, cap]);

  const parsedEmails = Number(emails);
  const parsedDays = Number(days);
  const valid =
    !enabled ||
    (Number.isInteger(parsedEmails) && parsedEmails >= 1 && Number.isInteger(parsedDays) && parsedDays >= 1);

  const save = () =>
    update.mutate({ frequencyCap: enabled ? { emails: parsedEmails, days: parsedDays } : null });

  return (
    <Card className="p-6 border-zinc-200 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-zinc-100 rounded-lg text-zinc-500 shrink-0">
          <Gauge size={20} />
        </div>
        <div className="space-y-3 text-sm text-zinc-600 w-full">
          <h3 className="text-lg font-medium text-zinc-900">Automation frequency cap</h3>
          <p>
            Limit how many automation emails one contact gets. An email step over the cap is skipped and the
            run goes on. Emails sent through the API and test runs are not counted against it.
          </p>
          {settings.isLoading ? (
            <div className="h-9 w-80 bg-zinc-100 rounded animate-pulse" />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-zinc-900">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  aria-label="Cap automation emails"
                />
                At most
              </label>
              <Input
                type="number"
                min={1}
                className="w-20"
                value={emails}
                disabled={!enabled}
                onChange={(e) => setEmails(e.target.value)}
                aria-label="Emails"
              />
              <span>emails per contact in</span>
              <Input
                type="number"
                min={1}
                className="w-20"
                value={days}
                disabled={!enabled}
                onChange={(e) => setDays(e.target.value)}
                aria-label="Days"
              />
              <span>days</span>
              <Button size="sm" variant="primary" onClick={save} disabled={!valid || update.isPending}>
                {update.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
          {update.error ? <p className="text-red-600">{update.error.message}</p> : null}
          {update.isSuccess && !update.isPending ? <p className="text-emerald-700">Saved.</p> : null}
        </div>
      </div>
    </Card>
  );
}
