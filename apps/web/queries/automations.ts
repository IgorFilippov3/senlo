import { useQuery } from "@tanstack/react-query";
import { getWorkflowStats } from "apps/web/app/(app)/workspace/[id]/automations/actions";

export const automationKeys = {
  all: ["automations"] as const,
  lists: () => [...automationKeys.all, "list"] as const,
  list: (projectId: number) => [...automationKeys.lists(), projectId] as const,
  details: () => [...automationKeys.all, "detail"] as const,
  detail: (id: number) => [...automationKeys.details(), id] as const,
  stats: (id: number) => [...automationKeys.detail(id), "stats"] as const,
};

export function useWorkflowStats(
  workflowId: number,
  options?: { enabled?: boolean; refetchInterval?: number },
) {
  return useQuery({
    queryKey: automationKeys.stats(workflowId),
    queryFn: async () => {
      const result = await getWorkflowStats(workflowId);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    enabled: options?.enabled,
    refetchInterval: options?.refetchInterval,
  });
}
