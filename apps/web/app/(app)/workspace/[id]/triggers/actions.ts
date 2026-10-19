"use server";

import { revalidatePath } from "next/cache";
import type {
  Campaign,
  CampaignEvent,
  EmailTemplate,
  LinkStat,
  Project,
  TimeSeriesData,
} from "@senlo/core";
import type {
  CampaignDetails,
  CreateTriggeredCampaignInput,
  UpdateTriggeredCampaignInput,
} from "@senlo/core/server";
import {
  ActionResult,
  FormActionResult,
  withErrorHandling,
  withFormErrors,
} from "apps/web/lib/errors";
import { requireUserId } from "apps/web/lib/session";
import { getServices } from "apps/web/lib/services";

const campaigns = () => getServices().campaign;

export async function getCampaignDetails(id: number): Promise<CampaignDetails | null> {
  const userId = await requireUserId();
  return campaigns().getDetails(userId, id);
}

export async function getPaginatedCampaignEvents(
  campaignId: number,
  page: number,
  pageSize: number,
  type?: string,
  search?: string,
): Promise<ActionResult<{ events: CampaignEvent[]; total: number }>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return campaigns().getEvents(userId, campaignId, { page, pageSize, type, search });
  });
}

export async function getCampaignLinkStats(
  campaignId: number,
): Promise<ActionResult<LinkStat[]>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return campaigns().getLinkStats(userId, campaignId);
  });
}

export async function getCampaignTimeSeriesStats(
  campaignId: number,
  options: { interval: "hour" | "day"; days?: number },
): Promise<ActionResult<TimeSeriesData[]>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return campaigns().getTimeSeriesStats(userId, campaignId, options);
  });
}

export async function listAllCampaigns(): Promise<ActionResult<Campaign[]>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return campaigns().listForUser(userId);
  });
}

export async function listProjectCampaigns(
  projectId: number,
): Promise<ActionResult<Campaign[]>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return campaigns().listForProject(userId, projectId);
  });
}

export async function getWizardData(): Promise<ActionResult<{ projects: Project[] }>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return { projects: await getServices().project.listForUser(userId) };
  });
}

export async function getTemplatesByProject(projectId: number): Promise<EmailTemplate[]> {
  const userId = await requireUserId();
  return getServices().template.listProjectTemplates(userId, projectId);
}

export async function createCampaignAction(
  formData: FormData,
): Promise<FormActionResult<Campaign, keyof CreateTriggeredCampaignInput | "general">> {
  return withFormErrors(async () => {
    const userId = await requireUserId();
    const campaign = await campaigns().createTriggered(userId, Object.fromEntries(formData));
    revalidatePath(`/workspace/${campaign.projectId}/triggers`);
    return campaign;
  });
}

export async function updateCampaignAction(
  id: number,
  formData: FormData,
): Promise<FormActionResult<Campaign, keyof UpdateTriggeredCampaignInput | "general">> {
  return withFormErrors(async () => {
    const userId = await requireUserId();
    const campaign = await campaigns().updateTriggered(userId, id, Object.fromEntries(formData));
    revalidatePath(`/workspace/${campaign.projectId}/triggers/${id}`);
    revalidatePath(`/workspace/${campaign.projectId}/triggers`);
    return campaign;
  });
}

export async function sendCampaignAction(
  id: number,
): Promise<ActionResult<{ success: boolean }>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    const { project } = await campaigns().send(userId, id);
    revalidatePath(`/workspace/${project.id}/triggers/${id}`);
    revalidatePath(`/workspace/${project.id}/triggers`);
    return { success: true };
  });
}

export async function deleteCampaignAction(id: number): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    const { project } = await campaigns().delete(userId, id);
    revalidatePath(`/workspace/${project.id}/triggers`);
  });
}
