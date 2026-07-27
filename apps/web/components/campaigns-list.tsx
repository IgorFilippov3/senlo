"use client";

import { Button } from "@senlo/ui";
import { TriggerCard } from "apps/web/app/(app)/workspace/[id]/triggers/trigger-card";
import { useCampaigns } from "../queries/campaigns";
import { useMemo } from "react";

interface TriggersListProps {
  showFilters?: boolean;
  projectId?: number;
}

export function TriggersList({
  showFilters = true,
  projectId,
}: TriggersListProps) {
  const { data: campaigns = [], isLoading, error, refetch } = useCampaigns();

  const filteredCampaigns = useMemo(() => {
    if (!projectId) return campaigns;
    return campaigns.filter((c) => c.projectId === projectId);
  }, [campaigns, projectId]);

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
        <Button onClick={() => refetch()} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {filteredCampaigns.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          No triggers found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCampaigns.map((campaign) => (
            <TriggerCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}
