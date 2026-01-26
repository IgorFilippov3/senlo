import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AiProvider } from "@senlo/core";
import {
  listAiProviders,
  createAiProviderAction,
  deleteAiProviderAction,
  toggleAiProviderAction,
} from "../app/(app)/providers/ai-actions";
import { queryKeys } from "../providers/query-keys";
import { logger } from "../lib/logger";

/**
 * Query function for fetching all AI providers
 */
async function fetchAiProviders(): Promise<AiProvider[]> {
  const result = await listAiProviders();

  if (!result.success) {
    throw new Error(result.error.message);
  }

  return result.data;
}

/**
 * Hook for fetching all AI providers
 */
export function useAiProviders() {
  return useQuery({
    queryKey: queryKeys.aiProviders.list(),
    queryFn: fetchAiProviders,
  });
}

/**
 * Hook for creating a new AI provider
 */
export function useCreateAiProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const result = await createAiProviderAction(formData);
      if (!result.success) {
        throw result;
      }
      return result.data;
    },
    onError: (err) => {
      logger.error("Failed to create AI provider", {
        error: err instanceof Error ? err.message : String(err),
      });
    },
    onSuccess: (provider) => {
      logger.info("AI provider created successfully", {
        providerId: provider.id,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.aiProviders.lists(),
      });
    },
  });
}

/**
 * Hook for deleting an AI provider
 */
export function useDeleteAiProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (providerId: number) => {
      const result = await deleteAiProviderAction(providerId);
      if (!result.success) {
        throw result;
      }
      return providerId;
    },
    onError: (err, providerId) => {
      logger.error("Failed to delete AI provider", {
        providerId,
        error: err instanceof Error ? err.message : String(err),
      });
    },
    onSuccess: (providerId) => {
      queryClient.removeQueries({
        queryKey: queryKeys.aiProviders.detail(providerId),
      });

      logger.info("AI provider deleted successfully", { providerId });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.aiProviders.lists(),
      });
    },
  });
}

/**
 * Hook for toggling AI provider active status
 */
export function useToggleAiProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      providerId,
      isActive,
    }: {
      providerId: number;
      isActive: boolean;
    }) => {
      const result = await toggleAiProviderAction(providerId, isActive);
      if (!result.success) {
        throw result;
      }
      return result.data;
    },
    onError: (err, { providerId }) => {
      logger.error("Failed to toggle AI provider status", {
        providerId,
        error: err instanceof Error ? err.message : String(err),
      });
    },
    onSuccess: (provider, { providerId }) => {
      queryClient.setQueryData(
        queryKeys.aiProviders.detail(providerId),
        provider,
      );

      queryClient.setQueryData<AiProvider[]>(
        queryKeys.aiProviders.list(),
        (old) =>
          old ? old.map((p) => (p.id === providerId ? provider : p)) : [],
      );

      logger.info("AI provider status toggled successfully", {
        providerId,
        isActive: provider.isActive,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.aiProviders.lists(),
      });
    },
  });
}
