"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Campaign } from "@senlo/core";
import type { FormValues } from "./actions";
import { useSenloActions } from "./provider";
import { queryKeys } from "./query-keys";
import { unwrap, unwrapForm } from "./result";

export function useProjectCampaigns(projectId: number) {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.campaigns.byProject(projectId),
    queryFn: async () => unwrap(await actions.campaigns.listForProject(projectId)),
    enabled: !!projectId,
  });
}

export function useCampaignEvents(
  campaignId: number,
  params: { page: number; pageSize: number; type?: string; search?: string },
) {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.campaigns.events(campaignId, params),
    queryFn: async () => unwrap(await actions.campaigns.events(campaignId, params)),
  });
}

export function useCampaignTimeSeries(
  campaignId: number,
  options: { days: number; interval: "hour" | "day" },
) {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.campaigns.timeSeries(campaignId, options),
    queryFn: async () => unwrap(await actions.campaigns.timeSeries(campaignId, options)),
  });
}

export function useCampaignLinkStats(campaignId: number) {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.campaigns.links(campaignId),
    queryFn: async () => unwrap(await actions.campaigns.linkStats(campaignId)),
  });
}

/** Creates a trigger; a validation failure rejects with the message to show. */
export function useCreateTriggeredCampaign() {
  const actions = useSenloActions();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: FormValues): Promise<Campaign> =>
      unwrapForm(await actions.campaigns.createTriggered(values), [
        "name",
        "projectId",
        "templateId",
        "fromEmail",
      ]),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.lists() }),
  });
}

/** Updates a trigger; a validation failure rejects with the message to show. */
export function useUpdateTriggeredCampaign(campaignId: number) {
  const actions = useSenloActions();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: FormValues): Promise<Campaign> =>
      unwrapForm(await actions.campaigns.updateTriggered(campaignId, values), [
        "name",
        "fromEmail",
        "variablesSchema",
      ]),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all }),
  });
}

export function useDeleteCampaign() {
  const actions = useSenloActions();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: number) => {
      unwrap(await actions.campaigns.delete(campaignId));
      return campaignId;
    },
    onSuccess: (campaignId) => {
      queryClient.removeQueries({ queryKey: queryKeys.campaigns.detail(campaignId) });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.lists() }),
  });
}
