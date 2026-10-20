import { NextRequest, NextResponse } from "next/server";
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
    const { event, contact } = await getServices().events.ingest(auth.apiKey.projectId, body);

    logger.info("Event processed via API", {
      event: event.event,
      projectId: auth.apiKey.projectId,
    });

    return NextResponse.json({ success: true, data: contact });
  } catch (error) {
    logger.error("Event API error", {
      error: error instanceof Error ? error.message : String(error),
      projectId: auth.apiKey.projectId,
    });
    return errorResponse(error);
  }
}
