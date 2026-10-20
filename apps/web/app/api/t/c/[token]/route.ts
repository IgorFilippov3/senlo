import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getServices } from "@/lib/services";
import { confirmLeavingResponse, requestMetadata } from "@/lib/tracking";

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

  const tracking = getServices().tracking;
  const click = await tracking.resolveClick(token, url, signature);
  if (!click.follow) {
    return confirmLeavingResponse(url);
  }

  const result = await tracking.trackClick(click.campaignId, click.email, url, requestMetadata(request));
  if (!result.success) {
    logger.error("Failed to track click", { error: result.error, campaignId: click.campaignId });
  }

  return NextResponse.redirect(url);
}
