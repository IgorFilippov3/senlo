// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { useCreateTriggeredCampaign } from "../data/campaigns";
import { useProjectTemplates } from "../data";
import { useSenloNavigation } from "../layout/navigation-context";
import { useCurrentWorkspace } from "../workspaces/WorkspaceScope";
import { TriggerWizard, type TriggerWizardValues } from "./TriggerWizard";

/** A new trigger in the current workspace; opens it once created. */
export function TriggerWizardScreen() {
  const workspace = useCurrentWorkspace();
  const { paths, push, back } = useSenloNavigation();
  const { data: templates = [], isLoading } = useProjectTemplates(workspace.id);
  const create = useCreateTriggeredCampaign();

  const handleSubmit = (values: TriggerWizardValues) => {
    create.mutate(
      { ...values, projectId: workspace.id },
      { onSuccess: (campaign) => push(paths.trigger(workspace.id, campaign.id)) },
    );
  };

  return (
    <TriggerWizard
      projectName={workspace.name}
      templates={templates}
      isLoadingTemplates={isLoading}
      onSubmit={handleSubmit}
      onCancel={back}
      isSubmitting={create.isPending}
      error={create.error?.message}
    />
  );
}
