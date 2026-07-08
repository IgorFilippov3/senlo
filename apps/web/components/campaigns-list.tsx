"use client";

import { Button } from "@senlo/ui";
import { TriggerCard } from "apps/web/app/(app)/triggers/trigger-card";
import { useCampaigns } from "../queries/campaigns";
import { useProjects } from "../queries/projects";
import { useMemo } from "react";

interface TriggersListProps {
  showFilters?: boolean;
}

export function TriggersList({ showFilters = true }: TriggersListProps) {
  const {
    data: campaigns = [],
    isLoading: isLoadingCampaigns,
    error: campaignsError,
    refetch: refetchCampaigns,
  } = useCampaigns();

  const {
    data: projects = [],
    isLoading: isLoadingProjects,
    error: projectsError,
    refetch: refetchProjects,
  } = useProjects();

  const groupedTriggers = useMemo(() => {
    if (!campaigns.length || !projects.length) return [];

    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const groups = new Map<number, { project: any; triggers: any[] }>();

    campaigns.forEach((campaign) => {
      const projectId = campaign.projectId;
      if (!groups.has(projectId)) {
        groups.set(projectId, {
          project: projectMap.get(projectId) || {
            name: "Unknown Project",
            id: projectId,
          },
          triggers: [],
        });
      }
      groups.get(projectId)!.triggers.push(campaign);
    });

    return Array.from(groups.values()).sort((a, b) =>
      a.project.name.localeCompare(b.project.name),
    );
  }, [campaigns, projects]);

  const isLoading = isLoadingCampaigns || isLoadingProjects;
  const error = campaignsError || projectsError;

  const handleRefetch = () => {
    refetchCampaigns();
    refetchProjects();
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-zinc-500">Loading triggers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 mb-4">Error loading triggers</div>
        <Button onClick={handleRefetch} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {campaigns.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          No triggers found.
        </div>
      ) : (
        groupedTriggers.map(({ project, triggers }) => (
          <section key={project.id} className="space-y-6">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-zinc-900">
                {project.name}
              </h2>
              <div className="h-px flex-1 bg-zinc-100" />
              <span className="text-sm text-zinc-500 font-medium">
                {triggers.length}{" "}
                {triggers.length === 1 ? "trigger" : "triggers"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {triggers.map((campaign) => (
                <TriggerCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
