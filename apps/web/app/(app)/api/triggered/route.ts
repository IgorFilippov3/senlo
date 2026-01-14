import { NextRequest, NextResponse } from "next/server";
import {
  CampaignRepository,
  EmailTemplateRepository,
  EmailProviderRepository,
  ProjectRepository,
  TriggeredSendLogRepository,
} from "@senlo/db";
import { replaceMergeTags, wrapLinksWithTracking } from "@senlo/core";
import { emailQueue } from "@senlo/core/src/queue";
import { logger, validateApiKey } from "apps/web/lib";

interface TriggeredEmailRequest {
  campaignId: string | number;
  to: string;
  data?: Record<string, unknown>;
}

const campaignRepo = new CampaignRepository();
const templateRepo = new EmailTemplateRepository();
const providerRepo = new EmailProviderRepository();
const projectRepo = new ProjectRepository();
const logRepo = new TriggeredSendLogRepository();

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
        { status: 400 }
      );
    }
    const { campaignId, to, data } = body;

    if (!campaignId || !to) {
      return NextResponse.json(
        { error: "campaignId and to (email) are required" },
        { status: 400 }
      );
    }

    const campaign = await campaignRepo.findById(Number(campaignId));
    if (!campaign || campaign.projectId !== apiKey.projectId) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (campaign.type !== "TRIGGERED") {
      return NextResponse.json(
        { error: "This campaign is not configured for API triggers" },
        { status: 400 }
      );
    }

    const [template, project] = await Promise.all([
      templateRepo.findById(campaign.templateId),
      projectRepo.findById(campaign.projectId),
    ]);

    if (!template)
      return NextResponse.json(
        { error: "Template not found" },
        { status: 500 }
      );
    if (!project)
      return NextResponse.json({ error: "Project not found" }, { status: 500 });
    if (!project.providerId) {
      return NextResponse.json(
        { error: "No email provider configured for this project" },
        { status: 400 }
      );
    }

    const provider = await providerRepo.findById(project.providerId);
    if (!provider) {
      return NextResponse.json(
        { error: "Email provider not found" },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const emailEncoded = encodeURIComponent(to);

    const openTrackingUrl = `${baseUrl}/api/track/open/${campaign.id}/${emailEncoded}`;
    const trackingPixel = `<img src="${openTrackingUrl}" width="1" height="1" style="display:none !important;" alt="" />`;

    const clickTrackingBaseUrl = `${baseUrl}/api/track/click/${campaign.id}/${emailEncoded}`;

    let personalizedHtml = replaceMergeTags(template.html, {
      custom: data,
      contact: { email: to, ...data },
      unsubscribeUrl: "#",
    });

    personalizedHtml = wrapLinksWithTracking(
      personalizedHtml,
      clickTrackingBaseUrl
    );

    personalizedHtml += trackingPixel;

    const fromAddress = campaign.fromName
      ? `${campaign.fromName} <${campaign.fromEmail || "hello@senlo.io"}>`
      : campaign.fromEmail || "hello@senlo.io";

    await emailQueue.add(`triggered-${campaign.id}-${to}-${Date.now()}`, {
      campaignId: campaign.id,
      contactId: 0,
      email: to,
      from: fromAddress,
      subject: campaign.subject || template.subject,
      html: personalizedHtml,
      providerId: project.providerId,
    });

    await logRepo.create({
      campaignId: campaign.id,
      email: to,
      status: "SUCCESS",
      error: null,
      data: data,
    });

    return NextResponse.json({
      success: true,
      message: "Email queued successfully",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error("Triggered email API error", {
      error: errorMessage,
      stack: errorStack,
      campaignId:
        typeof body?.campaignId === "number" ? body.campaignId : undefined,
      email: body?.to,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
