"use server";

import { revalidatePath } from "next/cache";
import {
  CampaignRepository, ProjectRepository, EmailTemplateRepository, EmailProviderRepository, TriggeredSendLogRepository, RecipientListRepository, db } from "@senlo/db";
import {
  Campaign,
  Project,
  EmailTemplate,
  CampaignEvent,
  encodeUnsubscribeToken,
  renderEmailDesign,
  wrapLinksWithTracking,
  EmailDesignDocument,
  LinkStat,
  TimeSeriesData,
} from "@senlo/core";
import { emailQueue } from "@senlo/core/src/queue";
import { ActionResult, withErrorHandling } from "apps/web/lib/errors";
import { logger } from "apps/web/lib/logger";
import { CreateCampaignSchema, UpdateCampaignSchema } from "./schemas";
import { auth } from "apps/web/auth";

const campaignRepo = new CampaignRepository(db);
const projectRepo = new ProjectRepository(db);
const templateRepo = new EmailTemplateRepository(db);
const providerRepo = new EmailProviderRepository(db);
const triggeredLogRepo = new TriggeredSendLogRepository(db);

async function getAuthorizedCampaign(campaignId: number) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");

  const campaign = await campaignRepo.findById(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  const project = await projectRepo.findById(campaign.projectId);
  if (!project || project.userId !== userId) {
    throw new Error("Unauthorized");
  }

  return { campaign, project, userId, session };
}

export async function getCampaignDetails(id: number): Promise<{
  campaign: Campaign;
  project: Project;
  template: EmailTemplate;
  stats: {
    sent: number;
    delivered: number;
    opens: { unique: number; total: number };
    clicks: { unique: number; total: number };
    errors: number;
  };
} | null> {
  const { campaign, project } = await getAuthorizedCampaign(id);

  const [template, eventStats, sendStats] = await Promise.all([
    templateRepo.findById(campaign.templateId),
    campaignRepo.getEventStatsByCampaign(id),
    triggeredLogRepo.getStatsByCampaign(id),
  ]);

  if (!template) return null;

  return {
    campaign,
    project,
    template,
    stats: {
      ...sendStats,
      opens: eventStats.opens,
      clicks: eventStats.clicks,
      errors: sendStats.errors,
    },
  };
}

export async function getPaginatedCampaignEvents(
  campaignId: number,
  page: number,
  pageSize: number,
  type?: string,
  search?: string,
): Promise<ActionResult<{ events: CampaignEvent[]; total: number }>> {
  return withErrorHandling(async () => {
    await getAuthorizedCampaign(campaignId);

    logger.debug("Fetching paginated campaign events", {
      campaignId,
      page,
      pageSize,
      type,
      search,
    });

    return await campaignRepo.getPaginatedEventsByCampaign(campaignId, {
      page,
      pageSize,
      type,
      search,
    });
  });
}

export async function getCampaignLinkStats(
  campaignId: number,
): Promise<ActionResult<LinkStat[]>> {
  return withErrorHandling(async () => {
    await getAuthorizedCampaign(campaignId);
    return await campaignRepo.getLinkStatsByCampaign(campaignId);
  });
}

export async function getCampaignTimeSeriesStats(
  campaignId: number,
  options: {
    interval: "hour" | "day";
    days?: number;
  },
): Promise<ActionResult<TimeSeriesData[]>> {
  return withErrorHandling(async () => {
    await getAuthorizedCampaign(campaignId);
    return await campaignRepo.getTimeSeriesStatsByCampaign(campaignId, options);
  });
}

export async function listAllCampaigns(): Promise<ActionResult<Campaign[]>> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };

  return withErrorHandling(async () => {
    logger.debug("Listing all campaigns for user", { userId });
    const projects = await projectRepo.findByUser(userId);
    const projectIds = projects.map((p) => p.id);

    if (projectIds.length === 0) return [];

    const allCampaigns = await Promise.all(
      projectIds.map((pid) => campaignRepo.findByProject(pid)),
    );
    return allCampaigns.flat();
  });
}

export async function listProjectCampaigns(
  projectId: number,
): Promise<ActionResult<Campaign[]>> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };

  return withErrorHandling(async () => {
    const project = await projectRepo.findById(projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Unauthorized");
    }

    logger.debug("Listing campaigns by project", { projectId });
    return await campaignRepo.findByProject(projectId);
  });
}

export async function getWizardData(): Promise<
  ActionResult<{ projects: Project[] }>
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };

  return withErrorHandling(async () => {
    logger.debug("Getting wizard data for user", { userId });
    const projects = await projectRepo.findByUser(userId);
    return { projects };
  });
}

export async function getTemplatesByProject(
  projectId: number,
): Promise<EmailTemplate[]> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");

  const project = await projectRepo.findById(projectId);
  if (!project || project.userId !== userId) throw new Error("Unauthorized");

  return templateRepo.findByProject(projectId);
}

export async function createCampaignAction(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId)
    return { error: { formErrors: ["Unauthorized"], fieldErrors: {} } };

  const parsed = CreateCampaignSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      error: parsed.error.flatten(),
    };
  }

  const {
    name,
    description,
    projectId,
    templateId,
    type,
    fromName,
    fromEmail,
    variablesSchema,
  } = parsed.data;

  try {
    const project = await projectRepo.findById(projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Unauthorized");
    }

    logger.info("Creating email trigger", {
      name,
      projectId,
      templateId,
      type,
    });

    const campaign = await campaignRepo.create({
      name,
      description,
      projectId,
      templateId,
      listId: null,
      type: "TRIGGERED",
      variablesSchema,
      fromName,
      fromEmail,
      status: "DRAFT",
    });

    revalidatePath(`/workspace/${projectId}/triggers`);

    logger.info("Email trigger created successfully", {
      campaignId: campaign.id,
    });

    return { success: true, data: campaign };
  } catch (error) {
    logger.error("Failed to create email trigger", {
      error: error instanceof Error ? error.message : String(error),
      name,
      projectId,
    });
    return {
      error: {
        formErrors: [],
        fieldErrors: { general: ["Failed to create email trigger"] },
      },
    };
  }
}

export async function updateCampaignAction(id: number, formData: FormData) {
  try {
    const { project } = await getAuthorizedCampaign(id);

    const parsed = UpdateCampaignSchema.safeParse(Object.fromEntries(formData));

    if (!parsed.success) {
      return {
        error: parsed.error.flatten(),
      };
    }

    const {
      name,
      description,
      fromName,
      fromEmail,
      variablesSchema,
      localeTemplates,
    } = parsed.data;

    logger.info("Updating campaign", { campaignId: id, name });

    const updatedCampaign = await campaignRepo.update(id, {
      name,
      description,
      fromName,
      fromEmail,
      variablesSchema,
      localeTemplates,
    });

    if (!updatedCampaign) {
      return {
        error: {
          formErrors: [],
          fieldErrors: { general: ["Campaign not found"] },
        },
      };
    }

    revalidatePath(`/workspace/${project.id}/triggers/${id}`);
    revalidatePath(`/workspace/${project.id}/triggers`);

    logger.info("Campaign updated successfully", { campaignId: id });

    return { success: true, data: updatedCampaign };
  } catch (error) {
    logger.error("Failed to update campaign", {
      error: error instanceof Error ? error.message : String(error),
      campaignId: id,
    });
    return {
      error: {
        formErrors: [],
        fieldErrors: { general: ["Failed to update campaign"] },
      },
    };
  }
}

export async function sendCampaignAction(
  id: number,
): Promise<ActionResult<{ sentCount: number }>> {
  return withErrorHandling(async () => {
    const { campaign, project } = await getAuthorizedCampaign(id);

    if (!project.providerId) {
      throw new Error("No email provider configured for this workspace");
    }

    const [template, provider] = await Promise.all([
      templateRepo.findById(campaign.templateId),
      providerRepo.findById(project.providerId),
    ]);

    if (!template) throw new Error("Template not found");
    if (!provider) throw new Error("Email provider not found");

    if (!campaign.listId) {
      throw new Error("No recipient list selected for this campaign");
    }

    const listRepo = new RecipientListRepository(db);
    const contacts = await listRepo.getContacts(campaign.listId, true);

    if (contacts.length === 0) {
      throw new Error("Recipient list is empty");
    }

    logger.info("Starting campaign send", {
      campaignId: id,
      recipientCount: contacts.length,
    });

    await campaignRepo.update(id, {
      status: "SENDING",
      sentAt: new Date(),
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    await Promise.all(
      contacts.map(async (contact) => {
        const emailEncoded = encodeURIComponent(contact.email);
        const unsubscribeToken = encodeUnsubscribeToken({
          contactId: contact.id,
          campaignId: id,
        });
        const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${unsubscribeToken}`;

        const openTrackingUrl = `${baseUrl}/api/track/open/${id}/${emailEncoded}`;
        const trackingPixel = `<img src="${openTrackingUrl}" width="1" height="1" style="display:none !important;" alt="" />`;

        const clickTrackingBaseUrl = `${baseUrl}/api/track/click/${id}/${emailEncoded}`;

        let personalizedHtml = template.designJson
          ? renderEmailDesign(template.designJson as EmailDesignDocument, {
              baseUrl,
              data: {
                contact,
                unsubscribeUrl,
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

        return emailQueue.add(`campaign-${id}-${contact.id}-${Date.now()}`, {
          projectId: project.id,
          campaignId: id,
          contactId: contact.id,
          email: contact.email,
          from: fromAddress,
          subject: campaign.subject || template.subject,
          html: personalizedHtml,
          providerId: project.providerId!,
        });
      }),
    );

    await campaignRepo.update(id, { status: "COMPLETED" });

    logger.info("Campaign queued successfully", {
      campaignId: id,
      sentCount: contacts.length,
    });

    revalidatePath(`/workspace/${project.id}/triggers/${id}`);
    revalidatePath(`/workspace/${project.id}/triggers`);

    return { sentCount: contacts.length };
  });
}

export async function deleteCampaignAction(
  id: number,
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const { project } = await getAuthorizedCampaign(id);
    logger.debug("Deleting email", { campaignId: id });
    await campaignRepo.delete(id);
    revalidatePath(`/workspace/${project.id}/triggers`);
  });
}
