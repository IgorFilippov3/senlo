import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project } from "@senlo/core";
import type { CreateWorkspaceValues, WorkspaceFormValues } from "@senlo/features";
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  listWorkspaces,
  updateWorkspace,
} from "../app/(app)/workspace/actions";
import { queryKeys } from "../providers";
import { unwrap, unwrapForm } from "./result";

/** Form fields in the order the workspace forms show them. */
const WORKSPACE_FIELDS = ["name", "description", "providerId", "aiProviderId"];

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects.lists(),
    queryFn: async () => unwrap(await listWorkspaces()),
  });
}

export function useProject(projectId: number) {
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: async () => unwrap(await getWorkspace(projectId)),
    enabled: projectId > 0,
  });
}

/** Rejects with the message to show when the form does not validate. */
export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: CreateWorkspaceValues) =>
      unwrapForm(await createWorkspace(values), WORKSPACE_FIELDS),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() }),
  });
}

/** Rejects with the message to show when the form does not validate. */
export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, values }: { projectId: number; values: WorkspaceFormValues }) =>
      unwrapForm(await updateWorkspace(projectId, values), WORKSPACE_FIELDS),
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: number) => {
      unwrap(await deleteWorkspace(projectId));
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
