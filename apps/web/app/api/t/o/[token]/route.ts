import { NextRequest } from "next/server";
import { openTrackingToken } from "@senlo/core";
import { logger } from "apps/web/lib/logger";
import { getServices } from "apps/web/lib/services";
import { getConfig } from "apps/web/lib/config";
import {
  pixelResponse,
  requestMetadata,
} from "apps/web/lib/tracking";

/** Open pixel. The token is sealed, so a forged one records nothing. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const recipient = await openTrackingToken(token, getConfig().linkSigningSecret);

  if (recipient) {
    // Fire and forget: the image must not wait for the database.
    getServices().tracking
      .trackOpen(recipient.campaignId, recipient.email, requestMetadata(request))
      .catch((error) => {
        logger.error("Failed to track open", {
          error: error instanceof Error ? error.message : String(error),
          campaignId: recipient.campaignId,
        });
      });
  }

  // Always an image: a broken one in the message helps nobody.
  return pixelResponse();
}
