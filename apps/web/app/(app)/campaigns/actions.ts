"use server";

import { revalidatePath } from "next/cache";
import {
  CampaignRepository,
  ProjectRepository,
  EmailTemplateRepository,
  RecipientListRepository,
  EmailProviderRepository,
  TriggeredSendLogRepository,
} from "@senlo/db";
import {
  Campaign,
  Project,
  EmailTemplate,
  CampaignEvent,
  RecipientList,
  TriggeredSendLog,
  encodeUnsubscribeToken,
  replaceMergeTags,
  wrapLinksWithTracking,
  MailerFactory,
} from "@senlo/core";
import { emailQueue } from "@senlo/core/src/queue";
import { ActionResult, withErrorHandling } from "apps/web/lib/errors";
import { logger } from "apps/web/lib/logger";
import { CreateCampaignSchema, UpdateCampaignSchema } from "./schemas";
import { auth } from "apps/web/auth";

const campaignRepo = new CampaignRepository();
const projectRepo = new ProjectRepository();
const templateRepo = new EmailTemplateRepository();
const listRepo = new RecipientListRepository();
const providerRepo = new EmailProviderRepository();
const triggeredLogRepo = new TriggeredSendLogRepository();

async function getAuthorizedCampaign(campaignId: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const campaign = await campaignRepo.findById(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  const project = await projectRepo.findById(campaign.projectId);
  if (!project || project.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  return { campaign, project, session };
}

export async function getCampaignDetails(id: number): Promise<{
  campaign: Campaign;
  project: Project;
  template: EmailTemplate;
  list: (RecipientList & { contactCount: number }) | null;
  events: CampaignEvent[];
  triggeredLogs: TriggeredSendLog[];
} | null> {
  const { campaign, project } = await getAuthorizedCampaign(id);

  const [template, list, events, triggeredLogs] = await Promise.all([
    templateRepo.findById(campaign.templateId),
    campaign.listId
      ? listRepo.findById(campaign.listId)
      : Promise.resolve(null),
    campaignRepo.getEventsByCampaign(id),
    triggeredLogRepo.findByCampaign(id),
  ]);

  if (!template) return null;

  let listWithCount = null;
  if (list) {
    const contactCount = await listRepo.getContactCount(list.id);
    listWithCount = { ...list, contactCount };
  }

  return {
    campaign,
    project,
    template,
    list: listWithCount,
    events,
    triggeredLogs,
  };
}

export async function listAllCampaigns(): Promise<ActionResult<Campaign[]>> {
  const session = await auth();
  if (!session?.user?.id)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };

  const userId = session.user.id;

  return withErrorHandling(async () => {
    logger.debug("Listing all campaigns for user", { userId });
    // This is a bit tricky, we need to filter by projects owned by the user
    const projects = await projectRepo.findByUser(userId);
    const projectIds = projects.map((p) => p.id);

    if (projectIds.length === 0) return [];

    // We might need a new repository method for this, or just filter manually for now
    // Actually, let's assume campaigns don't have findByUser yet.
    // I'll filter them manually or just get all for simplicity if the list is small,
    // but better to do it correctly.
    const allCampaigns = await Promise.all(
      projectIds.map((pid) => campaignRepo.findByProject(pid))
    );
    return allCampaigns.flat();
  });
}

export async function listProjectCampaigns(
  projectId: number
): Promise<ActionResult<Campaign[]>> {
  const session = await auth();
  if (!session?.user?.id)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };

  const userId = session.user.id;

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
  if (!session?.user?.id)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };

  const userId = session.user.id;

  return withErrorHandling(async () => {
    logger.debug("Getting wizard data for user", { userId });
    const projects = await projectRepo.findByUser(userId);
    return { projects };
  });
}

export async function getTemplatesByProject(
  projectId: number
): Promise<EmailTemplate[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const project = await projectRepo.findById(projectId);
  if (!project || project.userId !== session.user.id)
    throw new Error("Unauthorized");

  return templateRepo.findByProject(projectId);
}

export async function getListsByProject(
  projectId: number
): Promise<RecipientList[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const project = await projectRepo.findById(projectId);
  if (!project || project.userId !== session.user.id)
    throw new Error("Unauthorized");

  return listRepo.findByProject(projectId);
}

export async function createCampaignAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id)
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
    listId,
    type,
    fromName,
    fromEmail,
    subject,
    variablesSchema,
  } = parsed.data;

  try {
    // Check project ownership
    const project = await projectRepo.findById(projectId);
    if (!project || project.userId !== session.user.id) {
      throw new Error("Unauthorized");
    }

    let finalListId = listId;
    if (type === "STANDARD" && (!finalListId || isNaN(finalListId))) {
      const defaultList = await listRepo.getDefaultList(projectId);
      finalListId = defaultList.id;
    }

    logger.info("Creating campaign", {
      name,
      projectId,
      templateId,
      listId: finalListId,
      type,
    });

    const campaign = await campaignRepo.create({
      name,
      description,
      projectId,
      templateId,
      listId: type === "STANDARD" ? finalListId : null,
      type,
      variablesSchema,
      fromName,
      fromEmail,
      subject,
      status: "DRAFT",
    });

    revalidatePath("/campaigns");

    logger.info("Campaign created successfully", { campaignId: campaign.id });

    return { success: true, data: campaign };
  } catch (error) {
    logger.error("Failed to create campaign", {
      error: error instanceof Error ? error.message : String(error),
      name,
      projectId,
    });
    return {
      error: {
        formErrors: [],
        fieldErrors: { general: ["Failed to create campaign"] },
      },
    };
  }
}

export async function updateCampaignAction(id: number, formData: FormData) {
  try {
    const { campaign } = await getAuthorizedCampaign(id);

    const parsed = UpdateCampaignSchema.safeParse(Object.fromEntries(formData));

    if (!parsed.success) {
      return {
        error: parsed.error.flatten(),
      };
    }

    const { name, description, fromName, fromEmail, subject, variablesSchema } =
      parsed.data;

    logger.info("Updating campaign", { campaignId: id, name });

    const updatedCampaign = await campaignRepo.update(id, {
      name,
      description,
      fromName,
      fromEmail,
      subject,
      variablesSchema,
    });

    if (!updatedCampaign) {
      return {
        error: {
          formErrors: [],
          fieldErrors: { general: ["Campaign not found"] },
        },
      };
    }

    revalidatePath(`/campaigns/${id}`);
    revalidatePath("/campaigns");

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

export async function deleteCampaignAction(
  id: number
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    await getAuthorizedCampaign(id);
    logger.debug("Deleting campaign", { campaignId: id });
    await campaignRepo.delete(id);
    revalidatePath("/campaigns");
  });
}

export async function sendCampaignAction(
  campaignId: number
): Promise<{ success: boolean; sentCount: number }> {
  const { campaign, project } = await getAuthorizedCampaign(campaignId);

  const template = await templateRepo.findById(campaign.templateId);
  if (!template) throw new Error("Template not found");

  if (!project.providerId) {
    throw new Error(
      "No email provider configured for this project. Please set one in Project Settings."
    );
  }

  const provider = await providerRepo.findById(project.providerId);
  if (!provider) {
    throw new Error("Email provider not found. It may have been deleted.");
  }

  const mailer = MailerFactory.create(provider);

  if (!campaign.listId) {
    throw new Error("Campaign has no recipient list configured");
  }

  const activeContacts = await listRepo.getContacts(campaign.listId, true);
  if (activeContacts.length === 0) {
    throw new Error("No active contacts in the recipient list");
  }

  await campaignRepo.update(campaignId, {
    status: "SENDING",
  });
  revalidatePath(`/campaigns/${campaignId}`);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const jobs = activeContacts.map((contact) => {
    const token = encodeUnsubscribeToken({
      contactId: contact.id,
      campaignId: campaign.id,
    });
    const unsubscribeUrl = `${baseUrl}/unsubscribe/${token}`;

    const emailEncoded = encodeURIComponent(contact.email);
    const openTrackingUrl = `${baseUrl}/api/track/open/${campaign.id}/${emailEncoded}`;
    const trackingPixel = `<img src="${openTrackingUrl}" width="1" height="1" style="display:none !important;" alt="" />`;

    const clickTrackingBaseUrl = `${baseUrl}/api/track/click/${campaign.id}/${emailEncoded}`;

    let personalizedHtml = replaceMergeTags(template.html, {
      contact: contact,
      project: { name: project.name },
      campaign: { name: campaign.name, id: campaign.id },
      unsubscribeUrl,
    });

    personalizedHtml = wrapLinksWithTracking(
      personalizedHtml,
      clickTrackingBaseUrl
    );

    personalizedHtml += trackingPixel;

    return {
      name: `email-${campaignId}-${contact.id}`,
      data: {
        campaignId,
        contactId: contact.id,
        email: contact.email,
        from: campaign.fromEmail || "hello@senlo.io",
        subject: campaign.subject || template.subject,
        html: personalizedHtml,
        providerId: project.providerId!,
      },
    };
  });

  await emailQueue.addBulk(jobs);

  // We set it to COMPLETED for now because the queue will handle the rest,
  // but ideally, we should have a way to track when the queue finishes.
  // For a simple version, SENDING is good enough, and we can have another
  // process update it to COMPLETED.
  await campaignRepo.update(campaignId, {
    status: "COMPLETED",
    sentAt: new Date(),
  });

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");

  return { success: true, sentCount: activeContacts.length };
}
