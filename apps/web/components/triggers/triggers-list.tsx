"use client";

import Link from "next/link";
import type { Campaign } from "@senlo/core";
import { TriggersList as SharedTriggersList } from "@senlo/features";
import { useProjectCampaigns } from "apps/web/queries/campaigns";
import { useDialogStore } from "apps/web/providers/dialogs/store";

export function TriggersList({ projectId }: { projectId: number }) {
  const { data: campaigns = [], isLoading } = useProjectCampaigns(projectId);
  const openDialog = useDialogStore((state) => state.open);

  return (
    <SharedTriggersList
      campaigns={campaigns}
      isLoading={isLoading}
      onDelete={(campaign: Campaign) => openDialog("DELETE_TRIGGER", { campaign })}
      renderLink={(pId, cId, children) => (
        <Link href={`/workspace/${pId}/triggers/${cId}`}>{children}</Link>
      )}
    />
  );
}
