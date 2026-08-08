"use client";

import React from "react";
import type { Campaign } from "@senlo/core";
import { TriggerCard } from "./TriggerCard";

export interface TriggersListProps {
  campaigns: Campaign[];
  isLoading?: boolean;
  onDelete?: (campaign: Campaign) => void;
  renderLink?: (
    projectId: number,
    campaignId: number,
    children: React.ReactNode,
  ) => React.ReactNode;
}

export function TriggersList({
  campaigns,
  isLoading,
  onDelete,
  renderLink,
}: TriggersListProps) {
  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-zinc-500">Loading triggers...</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <TriggerCard
              key={campaign.id}
              campaign={campaign}
              onDelete={onDelete}
              renderLink={renderLink}
            />
          ))}
        </div>
      )}
    </div>
  );
}
