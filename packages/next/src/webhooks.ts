// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { NextResponse } from "next/server";
import { logError } from "@senlo/core";
import type { WebhookProviderType, WebhookResult } from "@senlo/core/server";
import type { SenloHost } from "./host";

const REJECTION_STATUS: Record<Extract<WebhookResult, { status: "rejected" }>["reason"], number> = {
  invalid_payload: 400,
  secret_not_configured: 401,
  invalid_signature: 401,
};

/** Rate limit, hand the raw request to `WebhookService`, map the result to a response. */
export async function handleProviderWebhook(
  host: SenloHost,
  req: Request,
  providerType: WebhookProviderType,
): Promise<NextResponse> {
  const limited = await host.rateLimit.limitRequest(req, "webhook");
  if (limited) return limited;

  const rawBody = await req.text();
  // Not logged anywhere: the headers carry the signature or the shared secret.
  const headers = Object.fromEntries(req.headers.entries());

  try {
    const result = await host.getServices().webhook.handle(providerType, rawBody, headers);
    if (result.status === "rejected") {
      return NextResponse.json({ error: result.reason }, { status: REJECTION_STATUS[result.reason] });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logError(host.logger, "Error processing provider webhook", error, { provider: providerType });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
