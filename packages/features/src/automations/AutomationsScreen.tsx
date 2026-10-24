// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import type { Workflow } from "@senlo/core";
import { Button, PageHeader } from "@senlo/ui";
import {
  WorkflowNotReadyError,
  useDeleteWorkflow,
  useProjectWorkflows,
  useSetWorkflowStatus,
} from "../data/workflows";
import { useSenloNavigation } from "../layout/navigation-context";
import { FormErrorBanner } from "../shared/FormErrorBanner";
import { useCurrentWorkspace } from "../workspaces/WorkspaceScope";
import { DeleteWorkflowDialog, GoLiveErrorsDialog } from "./WorkflowDialogs";
import { WorkflowList } from "./WorkflowList";

/** The workspace's automations: list, go live or pause, delete, open the editor. */
export function AutomationsScreen() {
  const workspace = useCurrentWorkspace();
  const { paths, renderLink } = useSenloNavigation();
  const { data: workflows = [], isLoading } = useProjectWorkflows(workspace.id);
  const setStatus = useSetWorkflowStatus();
  const remove = useDeleteWorkflow();
  const [toDelete, setToDelete] = useState<Workflow | null>(null);
  const [goLiveErrors, setGoLiveErrors] = useState<string[] | null>(null);

  const toggle = (workflow: Workflow) =>
    setStatus.mutate(
      { id: workflow.id, status: workflow.status === "ACTIVE" ? "PAUSED" : "ACTIVE" },
      {
        onError: (error) => {
          if (error instanceof WorkflowNotReadyError) setGoLiveErrors(error.reasons);
        },
      },
    );

  // A refused go-live opens its own dialog; any other failure shows above the list.
  const toggleError =
    setStatus.error && !(setStatus.error instanceof WorkflowNotReadyError) ? setStatus.error.message : null;

  const closeDelete = () => {
    remove.reset();
    setToDelete(null);
  };

  const busyId =
    (setStatus.isPending && setStatus.variables?.id) || (remove.isPending && remove.variables) || null;

  const newAutomationLink = (label: string, icon?: boolean) =>
    renderLink(
      paths.newAutomation(workspace.id),
      <Button>
        {icon && <Plus className="w-4 h-4 mr-2" />}
        {label}
      </Button>,
      "",
    );

  return (
    <div className="max-w-7xl mx-auto py-10 px-8 space-y-8">
      <PageHeader
        title="Automations"
        description="Build automated email sequences and lifecycle triggers."
        actions={newAutomationLink("Create Automation", true)}
      />

      <FormErrorBanner error={toggleError} />

      <WorkflowList
        workflows={workflows}
        isLoading={isLoading}
        busyId={busyId}
        onToggleStatus={toggle}
        onDelete={setToDelete}
        renderEditLink={(workflow, children) =>
          renderLink(paths.automation(workspace.id, workflow.id), children, "")
        }
        emptyAction={newAutomationLink("Create Automation")}
      />

      <DeleteWorkflowDialog
        isOpen={toDelete !== null}
        onClose={closeDelete}
        isDeleting={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => toDelete && remove.mutate(toDelete.id, { onSuccess: closeDelete })}
      />

      <GoLiveErrorsDialog reasons={goLiveErrors} onClose={() => setGoLiveErrors(null)} />
    </div>
  );
}
