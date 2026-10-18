import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import {
  TriggeredSendLogRepository,
  CampaignRepository,
  ProjectRepository,
  EmailProviderRepository,
} from "@senlo/db";
import { db } from "apps/web/lib/db";
import { logger } from "apps/web/lib";
import { limitRequest } from "apps/web/lib/rate-limit";
import { scopeWebhookEvent, suppressOnce } from "apps/web/lib/webhook-scope";

const logRepo = new TriggeredSendLogRepository(db);
const campaignRepo = new CampaignRepository(db);
const projectRepo = new ProjectRepository(db);
const providerRepo = new EmailProviderRepository(db);

interface ResendTag {
  name: string;
  value: string;
}

interface ResendWebhookEvent {
  type:
    | "email.delivered"
    | "email.bounced"
    | "email.complained"
    | "email.sent"
    | string;
  data: {
    email_id: string;
    to: string[];
    from: string;
    subject: string;
    tags?: Record<string, string> | ResendTag[];
    // Using unknown for index signature as Resend sends different data structures
    // based on event type (e.g., 'bounce', 'complaint' objects).
    [key: string]: unknown;
  };
}

export async function POST(req: NextRequest) {
  const limited = await limitRequest(req, "webhook");
  if (limited) return limited;

  const payload = await req.text();
  // Not logged: the svix headers include the signature.
  const headers = Object.fromEntries(req.headers.entries());

  // 1. Parse payload without verification first to get tags
  let jsonPayload: ResendWebhookEvent;
  try {
    jsonPayload = JSON.parse(payload) as ResendWebhookEvent;
  } catch (err) {
    logger.error("Failed to parse webhook payload", { error: err });
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const rawTags = jsonPayload.data?.tags || {};
  const tags: Record<string, string> = {};

  if (Array.isArray(rawTags)) {
    rawTags.forEach((t) => {
      if (t && typeof t === "object" && "name" in t && "value" in t) {
        tags[t.name] = String(t.value);
      }
    });
  } else if (rawTags && typeof rawTags === "object") {
    Object.entries(rawTags).forEach(([key, value]) => {
      tags[key] = String(value);
    });
  }

  const projectId = tags.project_id ? parseInt(tags.project_id) : null;

  if (!projectId) {
    logger.warn("Webhook received without project_id tag", {
      type: jsonPayload.type,
    });
    return NextResponse.json({ success: true });
  }

  // 2. Lookup project and its provider to get the secret
  const project = await projectRepo.findById(projectId);
  if (!project || !project.providerId) {
    logger.error("Project or provider not found for webhook", { projectId });
    return NextResponse.json({ success: true });
  }

  const provider = await providerRepo.findById(project.providerId);
  if (!provider || provider.type !== "RESEND") {
    logger.error("Provider not found or not Resend", {
      providerId: project.providerId,
    });
    return NextResponse.json({ success: true });
  }

  const secret = provider.config.webhook_secret as string | undefined;

  if (!secret) {
    logger.error("RESEND_WEBHOOK_SECRET is not set for provider", {
      providerId: provider.id,
    });
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  // 3. Verify signature using the secret from DB
  const wh = new Webhook(secret);

  let evt: ResendWebhookEvent;
  try {
    evt = wh.verify(payload, headers) as ResendWebhookEvent;
  } catch (err) {
    logger.error("Webhook verification failed", { error: err });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = evt;
  const providerMessageId = data.email_id;

  const campaignId = tags.campaign_id ? parseInt(tags.campaign_id) : null;
  const contactId =
    tags.contact_id && tags.contact_id !== "0"
      ? parseInt(tags.contact_id)
      : null;

  // Resend sends 'to' as an array
  const email = data.to?.[0];

  if (!providerMessageId || !email) {
    logger.warn("Webhook received without email_id or email", {
      type,
      providerMessageId,
      email,
    });
    return NextResponse.json({ success: true });
  }

  try {
    const { campaign, logEntry, contactId: scopedContactId } =
      await scopeWebhookEvent(projectId, {
        providerMessageId,
        campaignId,
        contactId,
        email,
      });

    if (
      type === "email.bounced" ||
      type === "email.complained" ||
      type === "email.delivered"
    ) {
      logger.info(`Processing ${type} for ${email}`, {
        providerMessageId,
        campaignId: campaignId ?? undefined,
      });

      // 2. Update log entry status
      if (logEntry) {
        const newStatus =
          type === "email.bounced"
            ? "BOUNCED"
            : type === "email.complained"
              ? "COMPLAINED"
              : "DELIVERED";

        await logRepo.update(logEntry.id, {
          status: newStatus,
          data: { ...logEntry.data, webhook_event: evt },
        });
      }

      // 3. Log the event onto the campaign, if it is this project's
      if (campaign) {
        await campaignRepo.logEvent({
          campaignId: campaign.id,
          contactId: scopedContactId,
          email,
          type:
            type === "email.bounced"
              ? "BOUNCE"
              : type === "email.complained"
                ? "SPAM_REPORT"
                : "DELIVERED",
          metadata: { resend_event: evt },
        });
      }

      // 4. Add to suppression list if it's a permanent failure
      if (type === "email.bounced" || type === "email.complained") {
        logger.info("Adding email to suppression list from Resend webhook", {
          projectId,
          email,
          reason: type,
        });
        await suppressOnce(
          projectId,
          email,
          type === "email.bounced" ? "BOUNCE" : "SPAM",
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error processing Resend webhook", {
      error: error instanceof Error ? error.message : String(error),
      type,
      email,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
