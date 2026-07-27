import { useState, useEffect, useMemo, useCallback } from "react";
import { EmailTemplate } from "@senlo/core";
import { listProjectTemplates } from "../app/(app)/workspace/[id]/templates/actions";

export interface TemplateFilters {
  projectId: number; // Required for templates
  search?: string;
  status?: string;
}

export interface UseTemplatesOptions {
  filters: TemplateFilters;
  enabled?: boolean;
}

/**
 * Hook for loading and filtering email templates
 *
 * @param options - Configuration options with required projectId and optional filters
 * @returns Object with templates data, loading state, error state, and filtering functions
 */
export function useTemplates(options: UseTemplatesOptions) {
  const { filters, enabled = true } = options;
  const { projectId, search, status } = filters;

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load templates for project
  useEffect(() => {
    if (!enabled || !projectId) return;

    const loadTemplates = async () => {
      try {
        setLoading(true);
        setError(null);

        const result = await listProjectTemplates(projectId.toString());

        if (result.success) {
          setTemplates(result.data);
        } else {
          setError(result.error.message);
          setTemplates([]);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load templates",
        );
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [enabled, projectId]);

  // Filter templates based on current filters
  const filteredTemplates = useMemo(() => {
    let filtered = [...templates];

    // Filter by search term (name or subject)
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (template) =>
          template.name.toLowerCase().includes(searchLower) ||
          template.subject.toLowerCase().includes(searchLower),
      );
    }

    // Filter by status
    if (status) {
      filtered = filtered.filter((template) => template.status === status);
    }

    return filtered;
  }, [templates, search, status]);

  const refetch = useCallback(async () => {
    if (!enabled || !projectId) return;

    try {
      setLoading(true);
      setError(null);

      const result = await listProjectTemplates(projectId.toString());

      if (result.success) {
        setTemplates(result.data);
      } else {
        setError(result.error.message);
        setTemplates([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, projectId]);

  // Optimistic updates
  const addTemplateOptimistic = useCallback((newTemplate: EmailTemplate) => {
    setTemplates((prev) => [...prev, newTemplate]);
  }, []);

  const updateTemplateOptimistic = useCallback(
    (templateId: number, updates: Partial<EmailTemplate>) => {
      setTemplates((prev) =>
        prev.map((template) =>
          template.id === templateId ? { ...template, ...updates } : template,
        ),
      );
    },
    [],
  );

  const removeTemplateOptimistic = useCallback((templateId: number) => {
    setTemplates((prev) =>
      prev.filter((template) => template.id !== templateId),
    );
  }, []);

  return {
    templates: filteredTemplates,
    allTemplates: templates,
    loading,
    error,
    refetch,
    // Computed values
    totalCount: templates.length,
    filteredCount: filteredTemplates.length,
    draftCount: templates.filter((t) => t.status === "draft").length,
    publishedCount: templates.filter((t) => t.status === "published").length,
    // Optimistic update methods
    addTemplateOptimistic,
    updateTemplateOptimistic,
    removeTemplateOptimistic,
  };
}
