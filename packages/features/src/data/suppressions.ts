"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSenloActions } from "./provider";
import { queryKeys } from "./query-keys";
import { unwrap } from "./result";

export function useProjectSuppressions(projectId: number) {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.suppressions.byProject(projectId),
    queryFn: async () => unwrap(await actions.suppressions.listForProject(projectId)),
    enabled: !!projectId,
  });
}

export function useDeleteSuppression() {
  const actions = useSenloActions();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (suppressionId: number) => {
      unwrap(await actions.suppressions.delete(suppressionId));
      return suppressionId;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.suppressions.all }),
  });
}
