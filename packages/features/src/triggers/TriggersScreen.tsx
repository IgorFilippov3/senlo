// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { Plus } from "lucide-react";
import type { Campaign } from "@senlo/core";
import { Button, PageHeader } from "@senlo/ui";
import { useProjectCampaigns } from "../data/campaigns";
import { useSenloDialogs } from "../dialogs/registry";
import { useSenloNavigation } from "../layout/navigation-context";
import { useCurrentWorkspace } from "../workspaces/WorkspaceScope";
import { TriggersList } from "./TriggersList";

/** The workspace's triggers: list, delete, open, new. */
export function TriggersScreen() {
  const workspace = useCurrentWorkspace();
  const { paths, renderLink } = useSenloNavigation();
  const { data: campaigns = [], isLoading } = useProjectCampaigns(workspace.id);
  const { open: openDialog } = useSenloDialogs();

  return (
    <main className="max-w-7xl mx-auto py-10 px-8">
      <PageHeader
        title="Email Triggers"
        description="Monitor and manage all your email triggers in one place."
        actions={renderLink(
          paths.newTrigger(workspace.id),
          <Button>
            <Plus size={16} />
            New Trigger
          </Button>,
          "",
        )}
      />

      <TriggersList
        campaigns={campaigns}
        isLoading={isLoading}
        onDelete={(campaign: Campaign) => openDialog("DELETE_TRIGGER", { campaign })}
        renderLink={(projectId, campaignId, children) =>
          renderLink(paths.trigger(projectId, campaignId), children, "")
        }
      />
    </main>
  );
}
