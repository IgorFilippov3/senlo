import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Campaign } from "@senlo/core";
import {
  listAllCampaigns,
  listProjectCampaigns,
  deleteCampaignAction,
} from "../app/(app)/workspace/[id]/triggers/actions";
import { queryKeys } from "../providers";
import { logger } from "../lib/logger";

/**
 * Query function for fetching all campaigns
 */
async function fetchAllCampaigns(): Promise<Campaign[]> {
  const result = await listAllCampaigns();

  if (!result.success) {
    throw new Error(result.error.message);
  }

  return result.data;
}

/**
 * Query function for fetching campaigns by project
 */
async function fetchProjectCampaigns(projectId: number): Promise<Campaign[]> {
  const result = await listProjectCampaigns(projectId);

  if (!result.success) {
    throw new Error(result.error.message);
  }

  return result.data;
}

/**
 * Hook for fetching all campaigns
 */
export function useCampaigns() {
  return useQuery({
    queryKey: queryKeys.campaigns.list(),
    queryFn: fetchAllCampaigns,
  });
}

/**
 * Hook for fetching campaigns by project
 */
export function useProjectCampaigns(projectId: number) {
  return useQuery({
    queryKey: queryKeys.campaigns.byProject(projectId),
    queryFn: () => fetchProjectCampaigns(projectId),
    enabled: !!projectId,
  });
}

/**
 * Hook for deleting a campaign
 */
export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: number) => {
      const result = await deleteCampaignAction(campaignId);
      if (!result.success) {
        throw result;
      }
      return campaignId;
    },
    onError: (err, campaignId) => {
      logger.error("Failed to delete campaign", {
        campaignId,
        error: err instanceof Error ? err.message : String(err),
      });
    },
    onSuccess: (campaignId) => {
      // Remove from individual campaign cache
      queryClient.removeQueries({
        queryKey: queryKeys.campaigns.detail(campaignId),
      });

      logger.info("Campaign deleted successfully", { campaignId });
    },
    onSettled: () => {
      // Invalidate all campaign lists to refresh UI
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.lists(),
      });
    },
  });
}
