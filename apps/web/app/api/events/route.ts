import { NextRequest, NextResponse } from "next/server";
import { logger, validateApiKey } from "apps/web/lib";
import { eventHandlers } from "apps/web/lib/events/handlers";
import { EventHandler, EventRequest } from "apps/web/lib/events/types";
import { WorkflowEventType } from "@senlo/core";

export async function POST(req: NextRequest) {
  try {
    const auth = await validateApiKey(req);
    if (!auth.success) return auth.response;

    const apiKey = auth.apiKey;
    const body: EventRequest = await req.json();

    if (!body.email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!body.event) {
      return NextResponse.json(
        { error: "Event name is required" },
        { status: 400 },
      );
    }

    const handler: EventHandler =
      eventHandlers[body.event as WorkflowEventType];
    if (!handler) {
      return NextResponse.json(
        { error: `Unsupported event: ${body.event}` },
        { status: 400 },
      );
    }

    const result = await handler(body, {
      projectId: apiKey.projectId,
    });

    if (!result) {
      throw new Error(`Failed to process event: ${body.event}`);
    }

    logger.info("Event processed via API", {
      event: body.event,
      email: body.email,
      projectId: apiKey.projectId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Event API error", {
      error: errorMessage,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
