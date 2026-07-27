import { useProjects as useProjectsQuery } from "../queries/projects";

/**
 * Hook for loading and managing projects data.
 * Re-exports the React Query version for consistency.
 */
export function useProjects() {
  const {
    data: projects = [],
    isLoading: loading,
    error,
    refetch,
  } = useProjectsQuery();

  return {
    projects,
    loading,
    error:
      error instanceof Error ? error.message : error ? String(error) : null,
    refetch,
    // Note: Optimistic methods are handled by useCreateProject/useDeleteProject in queries/projects.ts
    addProjectOptimistic: () => {},
    updateProjectOptimistic: () => {},
    removeProjectOptimistic: () => {},
  };
}
