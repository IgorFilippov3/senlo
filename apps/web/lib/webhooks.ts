import { NextRequest, NextResponse } from "next/server";
import type { WebhookProviderType, WebhookResult } from "@senlo/core/server";
import { limitRequest } from "./rate-limit";
import { getServices } from "./services";
import { logger } from "./logger";

const REJECTION_STATUS: Record<
  Extract<WebhookResult, { status: "rejected" }>["reason"],
  number
> = {
  invalid_payload: 400,
  secret_not_configured: 401,
  invalid_signature: 401,
};

/** Rate limit, hand the raw request to `WebhookService`, map the result to a response. */
export async function handleProviderWebhook(
  req: NextRequest,
  providerType: WebhookProviderType,
): Promise<NextResponse> {
  const limited = await limitRequest(req, "webhook");
  if (limited) return limited;

  const rawBody = await req.text();
  // Not logged anywhere: the headers carry the signature or the shared secret.
  const headers = Object.fromEntries(req.headers.entries());

  try {
    const result = await getServices().webhook.handle(providerType, rawBody, headers);
    if (result.status === "rejected") {
      return NextResponse.json(
        { error: result.reason },
        { status: REJECTION_STATUS[result.reason] },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error processing provider webhook", {
      provider: providerType,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
