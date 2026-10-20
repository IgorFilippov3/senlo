"use client";

import Link from "next/link";
import type { Campaign } from "@senlo/core";
import { TriggersList as SharedTriggersList, useProjectCampaigns } from "@senlo/features";
import { useDialogs } from "apps/web/providers/dialogs/store";

export function TriggersList({ projectId }: { projectId: number }) {
  const { data: campaigns = [], isLoading } = useProjectCampaigns(projectId);
  const { open: openDialog } = useDialogs();

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
