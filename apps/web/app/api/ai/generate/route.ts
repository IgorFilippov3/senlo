import { NextRequest, NextResponse } from "next/server";
import { auth } from "apps/web/auth";
import { errorResponse } from "apps/web/lib/errors";
import { logger } from "apps/web/lib/logger";
import { limitRequest } from "apps/web/lib/rate-limit";
import { getServices } from "apps/web/lib/services";

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await limitRequest(req, "ai", `user:${userId}`);
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    const design = await getServices().aiDesign.generate(userId, body);
    return NextResponse.json({ design });
  } catch (error) {
    logger.error("AI generation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(error, "Failed to generate template");
  }
}
