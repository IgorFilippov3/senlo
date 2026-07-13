import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Suppression } from "@senlo/core";
import { listAllSuppressions, deleteSuppressionAction } from "../app/(app)/audience/suppressions/actions";
import { queryKeys } from "../providers";
import { logger } from "../lib/logger";

type SuppressionWithProject = Suppression & { projectName: string };

/**
 * Hook for fetching all suppressions for the current user
 */
export function useSuppressions() {
  return useQuery({
    queryKey: queryKeys.suppressions.lists(),
    queryFn: async () => {
      const result = await listAllSuppressions();
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });
}

/**
 * Hook for deleting a suppression entry
 */
export function useDeleteSuppression() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const result = await deleteSuppressionAction(id);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppressions.lists() });
      logger.info("Suppression removed successfully");
    },
    onError: (err) => {
      logger.error("Failed to remove suppression", { 
        error: err instanceof Error ? err.message : String(err) 
      });
    }
  });
}
