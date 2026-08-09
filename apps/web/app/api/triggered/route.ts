import { NextRequest, NextResponse } from "next/server";
import {
  CampaignRepository,
  EmailTemplateRepository,
  EmailProviderRepository,
  ProjectRepository,
  TriggeredSendLogRepository,
  db,
} from "@senlo/db";
import { TriggerService } from "@senlo/core/src/services/triggerService";
import { emailQueue } from "@senlo/core/src/queue";
import { logger, validateApiKey } from "apps/web/lib";

interface TriggeredEmailRequest {
  id?: string | number;
  campaignId?: string | number;
  to: string;
  data?: Record<string, unknown>;
  locale?: string;
  subject?: string;
}

const triggerService = new TriggerService(
  new CampaignRepository(db),
  new EmailTemplateRepository(db),
  new EmailProviderRepository(db),
  new ProjectRepository(db),
  new TriggeredSendLogRepository(db),
  emailQueue,
);

export async function POST(req: NextRequest) {
  let body: TriggeredEmailRequest | null = null;

  try {
    const auth = await validateApiKey(req);
    if (!auth.success) return auth.response;

    const apiKey = auth.apiKey;

    body = await req.json();
    if (!body) {
      return NextResponse.json(
        { error: "Request body is required" },
        { status: 400 },
      );
    }
    
    const {
      id,
      campaignId: bodyCampaignId,
      to,
      data,
      locale,
      subject,
    } = body;
    
    const campaignId = id || bodyCampaignId;

    if (!campaignId || !to) {
      return NextResponse.json(
        { error: "id and to (email) are required" },
        { status: 400 },
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const result = await triggerService.sendTriggeredEmail({
      campaignId: Number(campaignId),
      projectId: apiKey.projectId,
      to,
      data,
      locale,
      subject,
      baseUrl,
    });

    // Check if the campaign belongs to the project (extra security check already in service potentially, but we have apiKey here)
    // Actually, the service doesn't have the apiKey context, so we should check ownership here or pass projectId to service.
    // Let's re-verify the service logic.
    
    logger.info("Triggered email processed via service", {
      campaignId,
      to,
      jobId: result.jobId,
    });

    return NextResponse.json({
      success: true,
      message: "Email queued successfully",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error("Triggered email API error", {
      error: errorMessage,
      campaignId: body?.id || body?.campaignId,
      email: body?.to,
    });

    const status = errorMessage.includes("not found") ? 404 : 400;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: status === 404 ? 404 : (errorMessage.includes("Internal") ? 500 : 400) },
    );
  }
}
