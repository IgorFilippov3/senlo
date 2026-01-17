"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  Card,
  Input,
} from "@senlo/ui";
import { useTemplates, TemplateFilters } from "../hooks/use-templates";
import { useProjects } from "../hooks/use-projects";
import { FileText, Search, Filter } from "lucide-react";

interface TemplatesListProps {
  initialFilters?: Partial<TemplateFilters>;
  showFilters?: boolean;
}

/**
 * Client component that displays templates with filtering capabilities
 * Uses useTemplates hook for data loading and filtering
 */
export function TemplatesList({
  initialFilters = {},
  showFilters = true,
}: TemplatesListProps) {
  const { projects } = useProjects();

  // Memoize initial filters to prevent recreating filters object
  const initialFiltersMemo = useMemo(() => initialFilters, [initialFilters]);

  // Memoize default project ID to prevent recreating filters
  const defaultProjectId = useMemo(
    () => (projects.length > 0 ? projects[0].id : 0),
    [projects],
  );

  const [filters, setFilters] = useState<TemplateFilters>(() => ({
    projectId: defaultProjectId,
    ...initialFiltersMemo,
  }));

  // Memoize filters object for useTemplates to prevent unnecessary hook calls
  const filtersForHook = useMemo(() => filters, [filters]);

  const {
    templates,
    loading,
    error,
    totalCount,
    filteredCount,
    draftCount,
    publishedCount,
    refetch,
  } = useTemplates({ filters: filtersForHook });

  // Stable reference for updateFilter to prevent child re-renders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateFilter = useCallback((key: keyof TemplateFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === "all" ? undefined : value,
    }));
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-zinc-500">Loading templates...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 mb-4">Error loading templates</div>
        <Button onClick={refetch} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showFilters && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={20} className="text-zinc-500" />
            <h3 className="font-medium">Filter Templates</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Project</label>
              <Select
                value={String(filters.projectId)}
                onValueChange={(val) => updateFilter("projectId", Number(val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <Select
                value={filters.status || "all"}
                onValueChange={(val) => updateFilter("status", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={refetch} variant="outline" size="sm">
                Refresh
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 flex gap-4 text-sm text-zinc-600">
            <span>Total: {totalCount}</span>
            <span>Filtered: {filteredCount}</span>
            <span>Draft: {draftCount}</span>
            <span>Published: {publishedCount}</span>
          </div>
        </Card>
      )}

      {/* Search */}
      {showFilters && (
        <div className="relative">
          <Search
            size={20}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400"
          />
          <Input
            placeholder="Search templates by name or subject..."
            value={filters.search || ""}
            onChange={(e) =>
              updateFilter("search", e.target.value || undefined)
            }
            className="pl-10"
          />
        </div>
      )}

      {/* Results */}
      {templates.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          {filteredCount === 0 && totalCount > 0
            ? "No templates match the current filters."
            : "No templates found."}
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">{template.name}</h3>
                    <p className="text-sm text-zinc-500">{template.subject}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-zinc-400">
                  Status: {template.status} • ID: {template.id}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
