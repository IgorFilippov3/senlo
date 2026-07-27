import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmailTemplate } from "@senlo/core";
import {
  listProjectTemplates,
  createTemplate as createTemplateAction,
  deleteTemplate as deleteTemplateAction,
} from "../app/(app)/workspace/[id]/templates/actions";
import { queryKeys } from "../providers";
import { logger } from "../lib/logger";

export interface TemplateFilters {
  projectId: number;
  search?: string;
  status?: string;
}

/**
 * Query function for fetching project templates
 */
async function fetchProjectTemplates(
  projectId: number,
): Promise<EmailTemplate[]> {
  const result = await listProjectTemplates(projectId.toString());

  if (!result.success) {
    throw new Error(result.error.message);
  }

  return result.data;
}

/**
 * Hook for fetching project templates with filtering
 */
export function useProjectTemplates(filters: TemplateFilters) {
  const { projectId, search, status } = filters;

  const query = useQuery({
    queryKey: queryKeys.templates.list(projectId, { search, status }),
    queryFn: () => fetchProjectTemplates(projectId),
    enabled: !!projectId,
    select: (data) => {
      // Apply client-side filtering
      let filtered = [...data];

      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(
          (template) =>
            template.name.toLowerCase().includes(searchLower) ||
            template.subject.toLowerCase().includes(searchLower),
        );
      }

      if (status) {
        filtered = filtered.filter((template) => template.status === status);
      }

      return filtered;
    },
  });

  return {
    ...query,
    // Add computed values
    totalCount: query.data?.length || 0,
    draftCount: query.data?.filter((t) => t.status === "draft").length || 0,
    publishedCount:
      query.data?.filter((t) => t.status === "published").length || 0,
  };
}

/**
 * Hook for creating a new template with optimistic updates
 */
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      formData,
    }: {
      projectId: string;
      formData: FormData;
    }) => {
      const result = await createTemplateAction(projectId, formData);
      if (!result.success) {
        throw result;
      }
      return result.data;
    },
    onError: (err, { projectId }) => {
      logger.error("Failed to create template", {
        projectId,
        error: err instanceof Error ? err.message : String(err),
      });
    },
    onSuccess: (data, { projectId }) => {
      logger.info("Template created successfully", {
        templateId: data.id,
        projectId,
      });
    },
    onSettled: (data, error, { projectId }) => {
      const numericProjectId = Number(projectId);
      // Invalidate and refetch templates for this project
      queryClient.invalidateQueries({
        queryKey: queryKeys.templates.lists(),
      });
    },
  });
}

/**
 * Hook for deleting a template with optimistic updates
 */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      templateId,
    }: {
      projectId: string;
      templateId: number;
    }) => {
      const result = await deleteTemplateAction(projectId, templateId);
      if (!result.success) {
        throw result;
      }
      return { projectId: Number(projectId), templateId };
    },
    onError: (err, { projectId, templateId }) => {
      logger.error("Failed to delete template", {
        templateId,
        projectId,
        error: err instanceof Error ? err.message : String(err),
      });
    },
    onSuccess: ({ templateId, projectId }) => {
      // Remove from individual template cache too
      queryClient.removeQueries({
        queryKey: queryKeys.templates.detail(templateId),
      });

      logger.info("Template deleted successfully", { templateId, projectId });
    },
    onSettled: (data, error, { projectId }) => {
      const numericProjectId = Number(projectId);
      // Always invalidate and refetch to sync with server
      queryClient.invalidateQueries({
        queryKey: queryKeys.templates.lists(),
      });
    },
  });
}
