import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { getServices } from "@/lib/services";
import { pixelResponse, requestMetadata } from "@senlo/next";

/** Open pixel. The token is sealed, so a forged one records nothing. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const tracking = getServices().tracking;
  const recipient = await tracking.resolveOpen(token);

  if (recipient) {
    // Fire and forget: the image must not wait for the database.
    void tracking
      .trackOpen(recipient.campaignId, recipient.email, requestMetadata(request))
      .then((result) => {
        if (!result.success) {
          logger.error("Failed to track open", { error: result.error, campaignId: recipient.campaignId });
        }
      });
  }

  // Always an image: a broken one in the message helps nobody.
  return pixelResponse();
}
