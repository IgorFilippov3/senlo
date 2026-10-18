import { NextRequest, NextResponse } from "next/server";
import {
  openTrackingToken,
  verifyClickSignature,
} from "@senlo/core";
import { logger } from "apps/web/lib/logger";
import { getServices } from "apps/web/lib/services";
import { getConfig } from "apps/web/lib/config";
import {
  confirmLeavingResponse,
  requestMetadata,
} from "apps/web/lib/tracking";

/**
 * Click redirect. The destination is signed together with the recipient
 * token, so `url` cannot be swapped for another address: an unsigned or
 * altered destination is shown, not followed, and nothing is recorded.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const signature = searchParams.get("s") ?? "";

  if (!url) {
    return new NextResponse("Invalid request", { status: 400 });
  }

  const secret = getConfig().linkSigningSecret;
  const [recipient, signed] = await Promise.all([
    openTrackingToken(token, secret),
    verifyClickSignature(token, url, signature, secret),
  ]);

  if (!recipient || !signed || !/^https?:\/\//i.test(url)) {
    return confirmLeavingResponse(url);
  }

  await getServices().tracking
    .trackClick(recipient.campaignId, recipient.email, url, requestMetadata(request))
    .catch((error) => {
      logger.error("Failed to track click", {
        error: error instanceof Error ? error.message : String(error),
        campaignId: recipient.campaignId,
      });
    });

  return NextResponse.redirect(url);
}
