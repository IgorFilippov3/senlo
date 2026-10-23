"use server";

import { revalidatePath } from "next/cache";
import type {
  Campaign,
  CampaignEvent,
  LinkStat,
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
} from "@senlo/next";
import { requireUserId } from "@/lib/session";
import { getServices } from "@/lib/services";

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

export async function listProjectCampaigns(
  projectId: number,
): Promise<ActionResult<Campaign[]>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return campaigns().listForProject(userId, projectId);
  });
}

/** Raw wizard fields in; the service validates them. */
export async function createCampaignAction(
  input: Record<string, unknown>,
): Promise<FormActionResult<Campaign, keyof CreateTriggeredCampaignInput | "general">> {
  return withFormErrors(async () => {
    const userId = await requireUserId();
    const campaign = await campaigns().createTriggered(userId, input);
    revalidatePath(`/workspace/${campaign.projectId}/triggers`);
    return campaign;
  });
}

export async function updateCampaignAction(
  id: number,
  input: Record<string, unknown>,
): Promise<FormActionResult<Campaign, keyof UpdateTriggeredCampaignInput | "general">> {
  return withFormErrors(async () => {
    const userId = await requireUserId();
    const campaign = await campaigns().updateTriggered(userId, id, input);
    revalidatePath(`/workspace/${campaign.projectId}/triggers/${id}`);
    revalidatePath(`/workspace/${campaign.projectId}/triggers`);
    return campaign;
  });
}

export async function deleteCampaignAction(id: number): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    const { project } = await campaigns().delete(userId, id);
    revalidatePath(`/workspace/${project.id}/triggers`);
  });
}
