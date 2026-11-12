// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { MailX } from "lucide-react";
import type { SendingSetup } from "@senlo/core";
import type { RenderLink } from "./Sidebar";

/**
 * Under the workspace switcher while the workspace cannot send email, so the
 * user learns it before a test send or an API call fails, with a link to
 * what fixes it.
 */
export function SendingDisabledNotice({
  setup,
  href,
  renderLink,
}: {
  setup: Exclude<SendingSetup, "ready">;
  href: string;
  renderLink: RenderLink;
}) {
  return (
    <div role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <div className="flex items-center gap-1.5 font-semibold">
        <MailX size={14} />
        Sending is disabled
      </div>
      <p className="mt-1 text-amber-800">
        {setup === "no-providers"
          ? "Add an email provider, then select it for this workspace."
          : "No email provider is selected for this workspace."}
      </p>
      {renderLink(
        href,
        setup === "no-providers" ? "Add a provider →" : "Choose a provider →",
        "mt-2 inline-block font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950",
      )}
    </div>
  );
}
