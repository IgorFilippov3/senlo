import { NextRequest, NextResponse } from "next/server";
import { CampaignRepository, db } from "@senlo/db";
import { logger } from "apps/web/lib/logger";

const campaignRepo = new CampaignRepository(db);

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

  try {
    const userAgent = request.headers.get("user-agent") || "unknown";
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    logger.debug("Tracking link click", {
      campaignId: id,
      email: decodedEmail,
      url: targetUrl,
    });

    await campaignRepo.logEvent({
      campaignId: id,
      email: decodedEmail,
      type: "CLICK",
      linkUrl: targetUrl,
      metadata: {
        userAgent,
        ip,
      },
    });
  } catch (error) {
    logger.error("Failed to log click event", {
      error: error instanceof Error ? error.message : String(error),
      campaignId: id,
      email: decodedEmail,
      url: targetUrl,
    });
  }

  // Always redirect to the target URL, even if logging fails
  return NextResponse.redirect(targetUrl);
}
