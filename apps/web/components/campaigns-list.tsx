"use client";

import { useCampaigns } from "../queries/campaigns";
import { useMemo } from "react";
import { TriggersList as SharedTriggersList } from "@senlo/features";
import { useDialogStore } from "apps/web/providers/dialogs/store";
import Link from "next/link";
import { Campaign } from "@senlo/core";

interface TriggersListProps {
  showFilters?: boolean;
  projectId?: number;
}

export function TriggersList({ projectId }: TriggersListProps) {
  const { data: campaigns = [], isLoading } = useCampaigns();
  const openDialog = useDialogStore((state) => state.open);

  const filteredCampaigns = useMemo(() => {
    if (!projectId) return campaigns;
    return campaigns.filter((c) => c.projectId === projectId);
  }, [campaigns, projectId]);

  const handleDelete = (campaign: Campaign) => {
    openDialog("DELETE_TRIGGER", { campaign });
  };

  const renderLink = (pId: number, cId: number, children: React.ReactNode) => (
    <Link href={`/workspace/${pId}/triggers/${cId}`}>{children}</Link>
  );

  return (
    <SharedTriggersList
      campaigns={filteredCampaigns}
      isLoading={isLoading}
      onDelete={handleDelete}
      renderLink={renderLink}
    />
  );
}
