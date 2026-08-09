import { NextRequest, NextResponse } from "next/server";
import { CampaignRepository, db } from "@senlo/db";
import { TrackingService } from "@senlo/core/src/services/trackingService";
import { logger } from "apps/web/lib/logger";

const trackingService = new TrackingService(new CampaignRepository(db));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string; email: string }> },
) {
  const { campaignId, email } = await params;
  const id = Number(campaignId);
  const decodedEmail = decodeURIComponent(email);

  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (isNaN(id) || !targetUrl) {
    return new NextResponse("Invalid request", { status: 400 });
  }

  const userAgent = request.headers.get("user-agent") || "unknown";
  const ip =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  // Record click event
  await trackingService.trackClick(id, decodedEmail, targetUrl, { userAgent, ip }).catch((error) => {
    logger.error("Failed to track click event", {
      error: error instanceof Error ? error.message : String(error),
      campaignId: id,
      email: decodedEmail,
      url: targetUrl,
    });
  });

  // Always redirect to the target URL
  return NextResponse.redirect(targetUrl);
}
