import { NextRequest, NextResponse } from "next/server";
import { confirmLeavingResponse } from "@/lib/tracking";
import { getServices } from "@/lib/services";

/**
 * Click link from mail sent before tracking links were signed. Its `url` was
 * never signed, so following it blindly made this an open redirect. It now
 * redirects only to a destination that appears in one of the campaign's
 * templates; anything else is shown on a page instead of followed. Clicks are
 * no longer recorded here, since the campaign and address are not verified.
 * New mail uses `/api/t/c/[token]`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string; email: string }> },
) {
  const { campaignId } = await params;
  const url = new URL(request.url).searchParams.get("url");

  if (!url) {
    return new NextResponse("Invalid request", { status: 400 });
  }

  if (await getServices().tracking.isLegacyClickTarget(Number(campaignId), url)) {
    return NextResponse.redirect(url);
  }
  return confirmLeavingResponse(url);
}
