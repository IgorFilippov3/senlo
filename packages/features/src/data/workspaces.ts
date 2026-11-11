"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project } from "@senlo/core";
import type { CreateWorkspaceValues } from "../workspaces/CreateWorkspaceDialog";
import type { WorkspaceFormValues } from "../workspaces/WorkspaceFields";
import { useSenloActions } from "./provider";
import { queryKeys } from "./query-keys";
import { unwrap, unwrapForm } from "./result";

/** Form fields in the order the workspace forms show them. */
const WORKSPACE_FIELDS = ["name", "description", "providerId", "aiProviderId"];

export function useProjects() {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.projects.lists(),
    queryFn: async () => unwrap(await actions.workspaces.list()),
  });
}

/** Days the project keeps each email's details (`days: null` is forever). Changes with a plan, so it is not cached long. */
export function useLogRetention(projectId: number) {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.projects.logRetention(projectId),
    queryFn: async () => unwrap(await actions.workspaces.logRetention(projectId)),
    enabled: !!projectId,
  });
}

/** The workspace's automation limits (frequency cap). */
export function useAutomationSettings(projectId: number) {
  const actions = useSenloActions();
  return useQuery({
    queryKey: queryKeys.projects.automationSettings(projectId),
    queryFn: async () => unwrap(await actions.workspaces.automationSettings(projectId)),
    enabled: !!projectId,
  });
}

/** Sets the frequency cap, or removes it with `frequencyCap: null`. */
export function useUpdateAutomationSettings(projectId: number) {
  const actions = useSenloActions();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: { frequencyCap: { emails: number; days: number } | null }) =>
      unwrap(await actions.workspaces.updateAutomationSettings(projectId, settings)),
    onSuccess: (settings) => queryClient.setQueryData(queryKeys.projects.automationSettings(projectId), settings),
  });
}

/** Rejects with the message to show when the form does not validate. */
export function useCreateProject() {
  const actions = useSenloActions();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: CreateWorkspaceValues) =>
      unwrapForm(await actions.workspaces.create(values), WORKSPACE_FIELDS),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() }),
  });
}

/** Rejects with the message to show when the form does not validate. */
export function useUpdateProject() {
  const actions = useSenloActions();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, values }: { projectId: number; values: WorkspaceFormValues }) =>
      unwrapForm(await actions.workspaces.update(projectId, values), WORKSPACE_FIELDS),
    onSuccess: (project: Project) => {
      queryClient.setQueryData(queryKeys.projects.detail(project.id), project);
      queryClient.setQueryData<Project[]>(queryKeys.projects.lists(), (old) =>
        old?.map((p) => (p.id === project.id ? project : p)),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
  });
}

export function useDeleteProject() {
  const actions = useSenloActions();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: number) => {
      unwrap(await actions.workspaces.delete(projectId));
      return projectId;
    },
    onSuccess: (projectId) => {
      queryClient.removeQueries({ queryKey: queryKeys.projects.detail(projectId) });
      queryClient.setQueryData<Project[]>(queryKeys.projects.lists(), (old) =>
        old?.filter((p) => p.id !== projectId),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() }),
  });
}
