"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateTemplateValues } from "../templates/CreateTemplateDialog";
import { useSenloActions } from "./provider";
import { queryKeys } from "./query-keys";
import { unwrap } from "./result";

export function useProjectTemplates(projectId: number) {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.templates.byProject(projectId),
    queryFn: async () => unwrap(await actions.templates.list(projectId)),
    enabled: !!projectId,
  });
}

export function useCreateTemplate() {
  const actions = useSenloActions();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, values }: { projectId: number; values: CreateTemplateValues }) =>
      unwrap(await actions.templates.create(projectId, values)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.templates.lists() }),
  });
}

export function useDeleteTemplate() {
  const actions = useSenloActions();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, templateId }: { projectId: number; templateId: number }) =>
      unwrap(await actions.templates.delete(projectId, templateId)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.templates.lists() }),
  });
}
