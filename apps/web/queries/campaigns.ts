import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Campaign } from "@senlo/core";
import {
  listProjectCampaigns,
  deleteCampaignAction,
  createCampaignAction,
  updateCampaignAction,
  getPaginatedCampaignEvents,
  getCampaignLinkStats,
  getCampaignTimeSeriesStats,
} from "../app/(app)/workspace/[id]/triggers/actions";
import { queryKeys } from "../providers";
import { logger } from "../lib/logger";
import { unwrap, unwrapForm } from "./result";

export function useProjectCampaigns(projectId: number) {
  return useQuery({
    queryKey: queryKeys.campaigns.byProject(projectId),
    queryFn: async () => unwrap(await listProjectCampaigns(projectId)),
    enabled: !!projectId,
  });
}

export function useCampaignEvents(
  campaignId: number,
  params: { page: number; pageSize: number; type?: string; search?: string },
) {
  return useQuery({
    queryKey: queryKeys.campaigns.events(campaignId, params),
    queryFn: async () =>
      unwrap(
        await getPaginatedCampaignEvents(
          campaignId,
          params.page,
          params.pageSize,
          params.type,
          params.search,
        ),
      ),
  });
}

export function useCampaignTimeSeries(
  campaignId: number,
  options: { days: number; interval: "hour" | "day" },
) {
  return useQuery({
    queryKey: queryKeys.analytics.timeSeries(campaignId, options),
    queryFn: async () => unwrap(await getCampaignTimeSeriesStats(campaignId, options)),
  });
}

export function useCampaignLinkStats(campaignId: number) {
  return useQuery({
    queryKey: queryKeys.analytics.links(campaignId),
    queryFn: async () => unwrap(await getCampaignLinkStats(campaignId)),
  });
}

/** Creates a trigger; a validation failure rejects with the message to show. */
export function useCreateTriggeredCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>): Promise<Campaign> => {
      return unwrapForm(await createCampaignAction(input), [
        "name",
        "projectId",
        "templateId",
        "fromEmail",
      ]);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.lists() });
    },
  });
}

/** Updates a trigger; a validation failure rejects with the message to show. */
export function useUpdateTriggeredCampaign(campaignId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData): Promise<Campaign> => {
      return unwrapForm(await updateCampaignAction(campaignId, formData), [
        "name",
        "fromEmail",
        "variablesSchema",
      ]);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: number) => {
      unwrap(await deleteCampaignAction(campaignId));
      return campaignId;
    },
    onError: (err, campaignId) => {
      logger.error("Failed to delete campaign", {
        campaignId,
        error: err instanceof Error ? err.message : String(err),
      });
    },
    onSuccess: (campaignId) => {
      queryClient.removeQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.lists() });
    },
  });
}
