// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import { Plus, Upload } from "lucide-react";
import { WORKFLOW_TEMPLATES, type Workflow, type WorkflowTemplate } from "@senlo/core";
import { Button, PageHeader } from "@senlo/ui";
import {
  WorkflowNotReadyError,
  useCreateFromTemplate,
  useDeleteWorkflow,
  useProjectWorkflows,
  useSetWorkflowStatus,
} from "../data/workflows";
import { useSenloNavigation } from "../layout/navigation-context";
import { FormErrorBanner } from "../shared/FormErrorBanner";
import { useCurrentWorkspace } from "../workspaces/WorkspaceScope";
import { DeleteWorkflowDialog, GoLiveErrorsDialog } from "./WorkflowDialogs";
import { WorkflowList } from "./WorkflowList";
import { ImportWorkflowDialog } from "./ImportWorkflowDialog";
import { TemplateGallery, TemplatePreviewDialog } from "./TemplateGallery";

/** The workspace's automations: list, go live or pause, delete, open the editor. */
export function AutomationsScreen() {
  const workspace = useCurrentWorkspace();
  const { paths, renderLink, push } = useSenloNavigation();
  const [importOpen, setImportOpen] = useState(false);
  const [preview, setPreview] = useState<WorkflowTemplate | null>(null);
  const fromTemplate = useCreateFromTemplate(workspace.id);
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
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            {newAutomationLink("Create Automation", true)}
          </div>
        }
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

      {!isLoading && workflows.length === 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Start from a template</h2>
            {renderLink(paths.newAutomation(workspace.id), <span className="text-sm text-blue-600 hover:underline">See all templates</span>, "")}
          </div>
          <TemplateGallery
            templates={WORKFLOW_TEMPLATES.filter((t) => t.popular).slice(0, 3)}
            showFilter={false}
            onOpen={(t) => {
              fromTemplate.reset();
              setPreview(t);
            }}
          />
        </section>
      )}

      <TemplatePreviewDialog
        template={preview}
        onClose={() => setPreview(null)}
        isCreating={fromTemplate.isPending}
        error={fromTemplate.error?.message}
        onUse={(name) =>
          preview &&
          fromTemplate.mutate(
            { templateId: preview.id, name },
            { onSuccess: (workflow) => push(paths.automation(workspace.id, workflow.id)) },
          )
        }
      />

      <DeleteWorkflowDialog
        isOpen={toDelete !== null}
        onClose={closeDelete}
        isDeleting={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => toDelete && remove.mutate(toDelete.id, { onSuccess: closeDelete })}
      />

      <GoLiveErrorsDialog reasons={goLiveErrors} onClose={() => setGoLiveErrors(null)} />

      <ImportWorkflowDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        projectId={workspace.id}
        onImported={(workflow) => {
          setImportOpen(false);
          push(paths.automation(workspace.id, workflow.id));
        }}
      />
    </div>
  );
}
