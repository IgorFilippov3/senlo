"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "apps/web/providers/query-keys";
import {
  listApiKeys,
  createApiKey,
  deleteApiKey,
} from "apps/web/app/(app)/workspace/[id]/settings/keys/actions";

/**
 * Hook to fetch API keys for a specific project
 */
export function useApiKeys(projectId: number, enabled: boolean = true) {
  const queryKey = queryKeys.apiKeys.byProject(projectId);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const result = await listApiKeys(projectId);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: enabled && !!projectId,
  });
}

/**
 * Hook to create a new API key
 */
export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      name,
    }: {
      projectId: number;
      name: string;
    }) => {
      const result = await createApiKey(projectId, name);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: (newApiKey, variables) => {
      // Update the cache with new API key immediately
      queryClient.setQueryData(
        queryKeys.apiKeys.byProject(variables.projectId),
        (oldData: any[] | undefined) => {
          return oldData ? [...oldData, newApiKey] : [newApiKey];
        },
      );

      // Also invalidate to ensure server sync
      queryClient.invalidateQueries({
        queryKey: queryKeys.apiKeys.all,
      });
    },
  });
}

/**
 * Hook to delete an API key
 */
export function useDeleteApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      apiKeyId,
      projectId,
    }: {
      apiKeyId: number;
      projectId: number;
    }) => {
      const result = await deleteApiKey(apiKeyId);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return { apiKeyId, projectId };
    },
    onSuccess: (data) => {
      // Remove the API key from cache immediately
      queryClient.setQueryData(
        queryKeys.apiKeys.byProject(data.projectId),
        (oldData: any[] | undefined) => {
          return oldData
            ? oldData.filter((key) => key.id !== data.apiKeyId)
            : [];
        },
      );

      // Also invalidate to ensure server sync
      queryClient.invalidateQueries({
        queryKey: queryKeys.apiKeys.all,
      });
    },
  });
}
