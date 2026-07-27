import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Project } from "@senlo/core";
import {
  listWorkspaces,
  createWorkspace as createProjectAction,
  deleteWorkspace as deleteProjectAction,
} from "../app/(app)/workspace/actions";
import {
  getWorkspaceById,
  updateWorkspace as updateProjectAction,
} from "../app/(app)/workspace/[id]/templates/actions";
import { queryKeys } from "../providers";
import { logger } from "../lib/logger";

/**
 * Query function for fetching all projects
 */
async function fetchProjects(): Promise<Project[]> {
  const result = await listWorkspaces();

  if (!result.success) {
    throw new Error(result.error.message);
  }

  return result.data;
}

/**
 * Query function for fetching a single project
 */
async function fetchProject(projectId: string): Promise<Project> {
  const result = await getWorkspaceById(projectId);

  if (!result.success || !result.data) {
    throw new Error("Workspace not found");
  }

  return result.data;
}

/**
 * Hook for fetching all projects
 */
export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects.lists(),
    queryFn: fetchProjects,
  });
}

/**
 * Hook for fetching a single project
 */
export function useProject(projectId: string | number) {
  const id = projectId.toString();

  return useQuery({
    queryKey: queryKeys.projects.detail(Number(id)),
    queryFn: () => fetchProject(id),
    enabled: !!projectId,
  });
}

/**
 * Hook for creating a new project with optimistic updates
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const result = await createProjectAction(formData);
      if (!result.success) {
        throw result; // Throw the entire result for error handling
      }
      return result.data;
    },
    onMutate: async (formData: FormData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.lists() });

      // Get form data for optimistic update
      const name = formData.get("name") as string;
      const description = formData.get("description") as string;

      // Create optimistic project
      const optimisticProject: Project = {
        id: Date.now(), // Temporary ID
        name,
        description: description || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Snapshot previous value
      const previousProjects = queryClient.getQueryData<Project[]>(
        queryKeys.projects.lists(),
      );

      // Optimistically update cache
      queryClient.setQueryData<Project[]>(queryKeys.projects.lists(), (old) =>
        old ? [...old, optimisticProject] : [optimisticProject],
      );

      // Return context with snapshot
      return { previousProjects, optimisticProject };
    },
    onError: (err, formData, context) => {
      // Rollback on error
      if (context?.previousProjects) {
        queryClient.setQueryData(
          queryKeys.projects.lists(),
          context.previousProjects,
        );
      }

      logger.error("Failed to create workspace", {
        error: err instanceof Error ? err.message : String(err),
      });
    },
    onSuccess: (data, formData, context) => {
      logger.info("Workspace created successfully", { projectId: data.id });
    },
    onSettled: () => {
      // Always invalidate and refetch to sync with server
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
    },
  });
}

/**
 * Hook for updating a project with optimistic updates
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      formData,
    }: {
      projectId: number;
      formData: FormData;
    }) => {
      await updateProjectAction(projectId, formData);

      // Fetch updated project to get the latest data
      const result = await getWorkspaceById(projectId.toString());
      if (!result.success || !result.data) {
        throw new Error("Failed to fetch updated workspace");
      }
      return result.data;
    },
    onMutate: async ({ projectId, formData }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.projects.detail(projectId),
      });
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.lists() });

      // Get form data for optimistic update
      const name = formData.get("name") as string;
      const description = formData.get("description") as string;
      const providerId = formData.get("providerId") as string;

      // Snapshot previous values
      const previousProject = queryClient.getQueryData<Project>(
        queryKeys.projects.detail(projectId),
      );
      const previousProjects = queryClient.getQueryData<Project[]>(
        queryKeys.projects.lists(),
      );

      // Optimistically update individual project cache
      if (previousProject) {
        const optimisticProject: Project = {
          ...previousProject,
          name,
          description: description || null,
          providerId: providerId ? Number(providerId) : null,
          updatedAt: new Date(),
        };

        queryClient.setQueryData(
          queryKeys.projects.detail(projectId),
          optimisticProject,
        );

        // Also update the project in the projects list
        queryClient.setQueryData<Project[]>(
          queryKeys.projects.lists(),
          (old) =>
            old
              ? old.map((p) => (p.id === projectId ? optimisticProject : p))
              : [],
        );
      }

      return { previousProject, previousProjects };
    },
    onError: (err, { projectId }, context) => {
      // Rollback on error
      if (context?.previousProject) {
        queryClient.setQueryData(
          queryKeys.projects.detail(projectId),
          context.previousProject,
        );
      }
      if (context?.previousProjects) {
        queryClient.setQueryData(
          queryKeys.projects.lists(),
          context.previousProjects,
        );
      }

      logger.error("Failed to update workspace", {
        projectId,
        error: err instanceof Error ? err.message : String(err),
      });
    },
    onSuccess: (updatedProject, { projectId }) => {
      // Update both caches with the actual server data
      queryClient.setQueryData(
        queryKeys.projects.detail(projectId),
        updatedProject,
      );

      queryClient.setQueryData<Project[]>(queryKeys.projects.lists(), (old) =>
        old ? old.map((p) => (p.id === projectId ? updatedProject : p)) : [],
      );

      logger.info("Workspace updated successfully", { projectId });
    },
    onSettled: (data, error, { projectId }) => {
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.detail(projectId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
    },
  });
}

/**
 * Hook for deleting a project with optimistic updates
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: number) => {
      const result = await deleteProjectAction(projectId);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return projectId;
    },
    onMutate: async (projectId: number) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.lists() });

      // Snapshot previous value
      const previousProjects = queryClient.getQueryData<Project[]>(
        queryKeys.projects.lists(),
      );

      // Optimistically remove project
      queryClient.setQueryData<Project[]>(queryKeys.projects.lists(), (old) =>
        old ? old.filter((p) => p.id !== projectId) : [],
      );

      // Return context with snapshot
      return { previousProjects };
    },
    onError: (err, projectId, context) => {
      // Rollback on error
      if (context?.previousProjects) {
        queryClient.setQueryData(
          queryKeys.projects.lists(),
          context.previousProjects,
        );
      }

      logger.error("Failed to delete workspace", {
        projectId,
        error: err instanceof Error ? err.message : String(err),
      });
    },
    onSuccess: (projectId) => {
      // Remove from individual project cache too
      queryClient.removeQueries({
        queryKey: queryKeys.projects.detail(projectId),
      });

      logger.info("Workspace deleted successfully", { projectId });
    },
    onSettled: () => {
      // Always invalidate and refetch to sync with server
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
    },
  });
}
