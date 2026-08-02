import { NextRequest, NextResponse } from "next/server";
import {
  CampaignRepository,
  EmailTemplateRepository,
  EmailProviderRepository,
  ProjectRepository,
  TriggeredSendLogRepository,
  db,
} from "@senlo/db";
import {
  renderEmailDesign,
  wrapLinksWithTracking,
  EmailDesignDocument,
  replaceMergeTags,
} from "@senlo/core";
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

const campaignRepo = new CampaignRepository(db);
const templateRepo = new EmailTemplateRepository(db);
const providerRepo = new EmailProviderRepository(db);
const projectRepo = new ProjectRepository(db);
const logRepo = new TriggeredSendLogRepository(db);

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
      subject: subjectOverride,
    } = body;
    const campaignId = id || bodyCampaignId;

    if (!campaignId || !to) {
      return NextResponse.json(
        { error: "id and to (email) are required" },
        { status: 400 },
      );
    }

    const campaign = await campaignRepo.findById(Number(campaignId));
    if (!campaign || campaign.projectId !== apiKey.projectId) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 },
      );
    }

    if (campaign.type !== "TRIGGERED") {
      return NextResponse.json(
        { error: "This campaign is not configured for API triggers" },
        { status: 400 },
      );
    }

    // Locale-based template selection
    let templateId = campaign.templateId;
    if (
      locale &&
      campaign.localeTemplates &&
      campaign.localeTemplates[locale]
    ) {
      templateId = campaign.localeTemplates[locale];
      logger.info("Using localized template", {
        campaignId: campaign.id,
        locale,
        templateId,
      });
    }

    const [template, project] = await Promise.all([
      templateRepo.findById(templateId),
      projectRepo.findById(campaign.projectId),
    ]);

    if (!template)
      return NextResponse.json(
        { error: "Template not found" },
        { status: 500 },
      );
    if (!project)
      return NextResponse.json({ error: "Project not found" }, { status: 500 });
    if (!project.providerId) {
      return NextResponse.json(
        { error: "No email provider configured for this project" },
        { status: 400 },
      );
    }

    const provider = await providerRepo.findById(project.providerId);
    if (!provider) {
      return NextResponse.json(
        { error: "Email provider not found" },
        { status: 500 },
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const emailEncoded = encodeURIComponent(to);

    const openTrackingUrl = `${baseUrl}/api/track/open/${campaign.id}/${emailEncoded}`;
    const trackingPixel = `<img src="${openTrackingUrl}" width="1" height="1" style="display:none !important;" alt="" />`;

    const clickTrackingBaseUrl = `${baseUrl}/api/track/click/${campaign.id}/${emailEncoded}`;

    let personalizedHtml = template.designJson
      ? renderEmailDesign(template.designJson as EmailDesignDocument, {
          baseUrl,
          data: {
            custom: data,
            contact: { email: to, ...data },
            unsubscribeUrl: "#",
          },
        })
      : template.html;

    personalizedHtml = wrapLinksWithTracking(
      personalizedHtml,
      clickTrackingBaseUrl,
    );

    personalizedHtml += trackingPixel;

    const fromAddress = campaign.fromName
      ? `${campaign.fromName} <${campaign.fromEmail || "hello@senlo.io"}>`
      : campaign.fromEmail || "hello@senlo.io";

    // Prepare subject with merge tags support
    const rawSubject = subjectOverride || template.subject;
    const personalizedSubject = replaceMergeTags(rawSubject, {
      custom: data,
      contact: { email: to, ...data },
      project: { name: project.name },
    });

    const log = await logRepo.create({
      campaignId: campaign.id,
      email: to,
      status: "PENDING",
      error: null,
      data: data,
    });

    const job = await emailQueue.add(
      `triggered-${campaign.id}-${to}-${Date.now()}`,
      {
        projectId: project.id,
        campaignId: campaign.id,
        contactId: null,
        logId: log.id,
        email: to,
        from: fromAddress,
        subject: personalizedSubject,
        html: personalizedHtml,
        providerId: project.providerId,
        replyTo: campaign.replyTo || undefined,
      },
    );

    logger.info("Triggered email queued successfully", {
      jobId: job.id,
      campaignId: campaign.id,
      to,
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
      campaignId: body?.id || body?.campaignId,
      email: body?.to,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
