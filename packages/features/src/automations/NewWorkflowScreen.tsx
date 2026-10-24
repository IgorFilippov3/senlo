// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { useCreateWorkflow } from "../data/workflows";
import { useSenloNavigation } from "../layout/navigation-context";
import { useCurrentWorkspace } from "../workspaces/WorkspaceScope";
import { NewWorkflowForm } from "./NewWorkflowForm";

/** A new automation in the current workspace; opens its editor once created. */
export function NewWorkflowScreen() {
  const workspace = useCurrentWorkspace();
  const { paths, push, back } = useSenloNavigation();
  const create = useCreateWorkflow(workspace.id);

  return (
    <NewWorkflowForm
      onSubmit={(name) =>
        create.mutate(name, { onSuccess: (workflow) => push(paths.automation(workspace.id, workflow.id)) })
      }
      onCancel={back}
      isSubmitting={create.isPending}
      error={create.error?.message}
    />
  );
}
