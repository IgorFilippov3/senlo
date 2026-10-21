"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiKey } from "@senlo/core";
import { useSenloActions } from "./provider";
import { queryKeys } from "./query-keys";
import { unwrap } from "./result";

export function useApiKeys(projectId: number) {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.apiKeys.byProject(projectId),
    queryFn: async () => unwrap(await actions.apiKeys.list(projectId)),
    enabled: !!projectId,
  });
}

export function useCreateApiKey() {
  const actions = useSenloActions();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, name }: { projectId: number; name: string }) =>
      unwrap(await actions.apiKeys.create(projectId, name)),
    onSuccess: ({ key: _key, ...listed }, { projectId }) => {
      // The plain key stays with the caller; the cached list holds the prefix only.
      queryClient.setQueryData<ApiKey[]>(queryKeys.apiKeys.byProject(projectId), (old) =>
        old ? [...old, listed] : [listed],
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all }),
  });
}

export function useDeleteApiKey() {
  const actions = useSenloActions();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ apiKeyId, projectId }: { apiKeyId: number; projectId: number }) => {
      unwrap(await actions.apiKeys.delete(apiKeyId));
      return { apiKeyId, projectId };
    },
    onSuccess: ({ apiKeyId, projectId }) => {
      queryClient.setQueryData<ApiKey[]>(queryKeys.apiKeys.byProject(projectId), (old) =>
        old?.filter((key) => key.id !== apiKeyId),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all }),
  });
}
