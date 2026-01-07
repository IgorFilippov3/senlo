import { NextRequest, NextResponse } from "next/server";
import { CampaignRepository } from "@senlo/db";
import { logger } from "apps/web/lib";

const campaignRepo = new CampaignRepository();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string; email: string }> }
) {
  const { campaignId, email } = await params;
  const decodedEmail = decodeURIComponent(email);

  const searchParams = req.nextUrl.searchParams;
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new NextResponse("Missing redirect URL", { status: 400 });
  }

  try {
    await campaignRepo.logEvent({
      campaignId: Number(campaignId),
      email: decodedEmail,
      type: "CLICK",
      linkUrl: targetUrl,
      metadata: {
        userAgent: req.headers.get("user-agent"),
        ip:
          req.headers.get("x-forwarded-for") ||
          (req as NextRequest & { ip: string }).ip,
      },
    });
  } catch (error) {
    logger.error("Failed to log email click event", {
      campaignId: Number(campaignId),
      email: decodedEmail,
      targetUrl,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  return NextResponse.redirect(targetUrl, 302);
}
