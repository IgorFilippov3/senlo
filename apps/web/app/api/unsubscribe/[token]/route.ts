import { NextRequest, NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import { logger } from "@/lib/logger";
import { limitRequest } from "@/lib/rate-limit";

/**
 * One-click unsubscribe. This is the address the List-Unsubscribe header
 * points at, and Gmail and Yahoo require it to act on a POST without asking
 * the recipient to confirm or sign in.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const limited = await limitRequest(request, "oneClick");
  if (limited) return limited;

  const { token } = await params;

  try {
    const result = await getServices().unsubscribe.process(token);

    if (!result.ok) {
      if (result.reason === "confirm_email") {
        // A legacy unsigned link: one-click cannot prove who is asking, so
        // the recipient has to open the page and confirm their address.
        return new NextResponse(
          "Open the unsubscribe link in a browser to confirm",
          { status: 400 },
        );
      }
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
