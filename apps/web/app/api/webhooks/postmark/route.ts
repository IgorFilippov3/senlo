import { NextRequest, NextResponse } from "next/server";
import {
  TriggeredSendLogRepository, CampaignRepository, ProjectRepository, EmailProviderRepository, SuppressionRepository, db } from "@senlo/db";
import { logger } from "apps/web/lib";

const logRepo = new TriggeredSendLogRepository(db);
const campaignRepo = new CampaignRepository(db);
const projectRepo = new ProjectRepository(db);
const providerRepo = new EmailProviderRepository(db);
const suppressionRepo = new SuppressionRepository(db);

interface PostmarkWebhookPayload {
  RecordType: "Delivery" | "Bounce" | "Open" | "Click" | "SpamComplaint";
  MessageID: string;
  Recipient?: string;
  Email?: string; // For Bounce
  Metadata?: Record<string, string>;
  DeliveredAt?: string;
  BouncedAt?: string;
  ReceivedAt?: string; // For Open/Click
  Type?: string; // For Bounce
  OriginalLink?: string; // For Click
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
  logger.info("Postmark webhook request received");
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  let jsonPayload: PostmarkWebhookPayload;
  try {
    jsonPayload = JSON.parse(payload) as PostmarkWebhookPayload;
  } catch (err) {
    logger.error("Failed to parse Postmark webhook payload", { error: err });
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const metadata = jsonPayload.Metadata || {};
  const projectId = metadata.project_id ? parseInt(metadata.project_id) : null;

  if (!projectId) {
    logger.warn("Postmark webhook received without project_id metadata", {
      recordType: jsonPayload.RecordType,
    });
    return NextResponse.json({ success: true });
  }

  // Lookup project and its provider to verify secret
  const project = await projectRepo.findById(projectId);
  if (!project || !project.providerId) {
    logger.error("Project or provider not found for Postmark webhook", { projectId });
    return NextResponse.json({ success: true });
  }

  const provider = await providerRepo.findById(project.providerId);
  if (!provider || provider.type !== "POSTMARK") {
    logger.error("Provider not found or not Postmark", {
      providerId: project.providerId,
    });
    return NextResponse.json({ success: true });
  }

  const configuredSecret = provider.config.webhook_secret as string | undefined;
  const receivedSecret = headers["x-postmark-secret"];

  if (configuredSecret && configuredSecret !== receivedSecret) {
    logger.error("Postmark webhook secret verification failed", {
      providerId: provider.id,
    });
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const { RecordType, MessageID, Metadata } = jsonPayload;
  const email = jsonPayload.Recipient || jsonPayload.Email;
  const campaignId = Metadata?.campaign_id ? parseInt(Metadata.campaign_id) : null;
  const contactId = Metadata?.contact_id && Metadata.contact_id !== "0" ? parseInt(Metadata.contact_id) : null;

  if (!MessageID || !email) {
    logger.warn("Postmark webhook received without MessageID or email", {
      RecordType,
      MessageID,
      email,
    });
    return NextResponse.json({ success: true });
  }

  try {
    let logEntry = await logRepo.findByProviderMessageId(MessageID);

    if (!logEntry && campaignId) {
      logEntry = await logRepo.findLatestByCampaignAndEmail(campaignId, email);
    }

    // Map Postmark RecordType to Senlo events
    if (RecordType === "Delivery" || RecordType === "Bounce" || RecordType === "SpamComplaint") {
      if (logEntry) {
        const newStatus = 
          RecordType === "Bounce" ? "BOUNCED" :
          RecordType === "SpamComplaint" ? "COMPLAINED" :
          "DELIVERED";

        await logRepo.update(logEntry.id, {
          status: newStatus,
          data: { ...logEntry.data, postmark_event: jsonPayload },
        });
      }

      if (campaignId) {
        await campaignRepo.logEvent({
          campaignId,
          contactId,
          email,
          type: 
            RecordType === "Bounce" ? "BOUNCE" :
            RecordType === "SpamComplaint" ? "SPAM_REPORT" :
            "DELIVERED",
          metadata: { postmark_event: jsonPayload },
        });
      }

      // 4. Add to suppression list if it's a permanent failure
      if (RecordType === "Bounce" || RecordType === "SpamComplaint") {
        logger.info("Adding email to suppression list from Postmark webhook", {
          projectId,
          email,
          reason: RecordType,
        });
        await suppressionRepo.create({
          projectId,
          email,
          reason: RecordType === "Bounce" ? "BOUNCE" : "SPAM",
        });
      }
    } else if (RecordType === "Open" || RecordType === "Click") {
      if (campaignId) {
        await campaignRepo.logEvent({
          campaignId,
          contactId,
          email,
          type: RecordType === "Open" ? "OPEN" : "CLICK",
          metadata: { 
            postmark_event: jsonPayload,
            url: jsonPayload.OriginalLink 
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error processing Postmark webhook", {
      error: error instanceof Error ? error.message : String(error),
      RecordType,
      email,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
