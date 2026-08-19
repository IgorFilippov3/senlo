import { NextRequest, NextResponse } from "next/server";
import {
  ContactRepository,
  WorkflowRepository,
  WorkflowExecutionRepository,
  SuppressionRepository,
  CampaignRepository,
  EmailTemplateRepository,
  EmailProviderRepository,
  ProjectRepository,
  TriggeredSendLogRepository,
  db,
} from "@senlo/db";
import {
  AudienceService,
  AutomationService,
  TriggerService,
} from "@senlo/core";
import { automationQueue, emailQueue } from "@senlo/core/src/queue";
import { logger, validateApiKey } from "apps/web/lib";

const campaignRepo = new CampaignRepository(db);
const templateRepo = new EmailTemplateRepository(db);
const providerRepo = new EmailProviderRepository(db);
const projectRepo = new ProjectRepository(db);
const logRepo = new TriggeredSendLogRepository(db);

const triggerService = new TriggerService(
  campaignRepo,
  templateRepo,
  providerRepo,
  projectRepo,
  logRepo,
  emailQueue,
);

const workflowRepo = new WorkflowRepository(db);
const executionRepo = new WorkflowExecutionRepository(db);
const contactRepo = new ContactRepository(db);

const automationService = new AutomationService(
  workflowRepo,
  executionRepo,
  contactRepo,
  automationQueue,
  triggerService,
);

const audienceService = new AudienceService(
  new SuppressionRepository(db),
  contactRepo,
  workflowRepo,
  automationService,
);

interface CreateContactRequest {
  email: string;
  name?: string;
  meta?: Record<string, any>;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await validateApiKey(req);
    if (!auth.success) return auth.response;

    const apiKey = auth.apiKey;
    const body: CreateContactRequest = await req.json();

    if (!body.email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const contact = await audienceService.createContact({
      projectId: apiKey.projectId,
      email: body.email,
      name: body.name,
      locale: (body as any).locale,
      meta: body.meta,
    });

    logger.info("Contact created via API", {
      contactId: contact.id,
      email: contact.email,
      projectId: apiKey.projectId,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: contact.id,
        email: contact.email,
        name: contact.name,
        meta: contact.meta,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Create contact API error", {
      error: errorMessage,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
