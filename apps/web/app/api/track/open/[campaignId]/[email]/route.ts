import { NextRequest, NextResponse } from "next/server";
import { CampaignRepository, db } from "@senlo/db";
import { TrackingService } from "@senlo/core/src/services/trackingService";
import { logger } from "apps/web/lib/logger";

const trackingService = new TrackingService(new CampaignRepository(db));

// 1x1 transparent GIF
const TRANSPARENT_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string; email: string }> },
) {
  const { campaignId, email } = await params;
  const id = Number(campaignId);
  const decodedEmail = decodeURIComponent(email);

  if (isNaN(id)) {
    return new NextResponse("Invalid campaign ID", { status: 400 });
  }

  const userAgent = request.headers.get("user-agent") || "unknown";
  const ip =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  // Fire and forget, don't block the response
  trackingService.trackOpen(id, decodedEmail, { userAgent, ip }).catch((error) => {
    logger.error("Failed to track open in background", {
      error: error instanceof Error ? error.message : String(error),
      campaignId: id,
      email: decodedEmail,
    });
  });

  return new NextResponse(TRANSPARENT_PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
