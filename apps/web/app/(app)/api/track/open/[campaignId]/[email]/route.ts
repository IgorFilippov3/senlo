import { NextRequest, NextResponse } from "next/server";
import { CampaignRepository } from "@senlo/db";
import { logger } from "apps/web/lib";
import { PIXEL } from "apps/web/constants/pixel";

const campaignRepo = new CampaignRepository();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string; email: string }> }
) {
  const { campaignId, email } = await params;
  const decodedEmail = decodeURIComponent(email);

  try {
    await campaignRepo.logEvent({
      campaignId: Number(campaignId),
      email: decodedEmail,
      type: "OPEN",
      metadata: {
        userAgent: req.headers.get("user-agent"),
        ip:
          req.headers.get("x-forwarded-for") ||
          (req as NextRequest & { ip: string }).ip,
      },
    });
  } catch (error) {
    logger.error("Failed to log email open event", {
      campaignId: Number(campaignId),
      email: decodedEmail,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
