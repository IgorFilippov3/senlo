import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { logger, validateApiKey } from "@/lib";
import { errorResponse } from "@/lib/errors";
import { limitRequest } from "@/lib/rate-limit";
import { getServices } from "@/lib/services";

export async function POST(req: NextRequest) {
  const limited = await limitRequest(req, "api");
  if (limited) return limited;

  const auth = await validateApiKey(req);
  if (!auth.success) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const result = await getServices().trigger.sendFromRequest(
      auth.apiKey.projectId,
      body,
      getConfig().appUrl,
    );

    logger.info("Triggered email queued via API", {
      projectId: auth.apiKey.projectId,
      jobId: result.jobId,
    });

    return NextResponse.json({ success: true, message: "Email queued successfully" });
  } catch (error) {
    logger.error("Triggered email API error", {
      error: error instanceof Error ? error.message : String(error),
      projectId: auth.apiKey.projectId,
    });
    return errorResponse(error);
  }
}
