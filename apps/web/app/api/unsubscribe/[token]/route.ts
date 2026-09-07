import { NextRequest, NextResponse } from "next/server";
import { processUnsubscribe } from "apps/web/lib/unsubscribe";
import { logger } from "apps/web/lib/logger";

/**
 * One-click unsubscribe. This is the address the List-Unsubscribe header
 * points at, and Gmail and Yahoo require it to act on a POST without asking
 * the recipient to confirm or sign in.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  try {
    const result = await processUnsubscribe(token);

    if (!result.ok) {
      return new NextResponse(
        result.reason === "invalid" ? "Invalid token" : "Recipient not found",
        { status: result.reason === "invalid" ? 400 : 404 },
      );
    }

    return new NextResponse("Unsubscribed", { status: 200 });
  } catch (error) {
    logger.error("One-click unsubscribe failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return new NextResponse("Unsubscribe failed", { status: 500 });
  }
}
