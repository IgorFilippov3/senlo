// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from "@senlo/core";
import { Button, Card, Input, PageHeader } from "@senlo/ui";
import { Plus } from "lucide-react";
import { useCreateFromTemplate, useCreateWorkflow } from "../data/workflows";
import { useSenloNavigation } from "../layout/navigation-context";
import { FormErrorBanner } from "../shared";
import { useCurrentWorkspace } from "../workspaces/WorkspaceScope";
import { TemplateGallery, TemplatePreviewDialog } from "./TemplateGallery";

/**
 * A new automation in the current workspace: from scratch (a name), or from
 * a gallery template (D10). Opens the editor once created.
 */
export function NewWorkflowScreen() {
  const workspace = useCurrentWorkspace();
  const { paths, push, back } = useSenloNavigation();
  const create = useCreateWorkflow(workspace.id);
  const fromTemplate = useCreateFromTemplate(workspace.id);
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<WorkflowTemplate | null>(null);

  const open = (id: number) => push(paths.automation(workspace.id, id));

  return (
    <div className="max-w-7xl mx-auto py-10 px-8 space-y-8">
      <PageHeader
        title="New automation"
        description="Start from scratch, or from a template you can change step by step."
        actions={
          <Button variant="ghost" onClick={back}>
            Cancel
          </Button>
        }
      />

      <Card className="p-5 border-gray-200">
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate(name, { onSuccess: (workflow) => open(workflow.id) });
          }}
        >
          <Plus className="w-5 h-5 text-gray-400" />
          <span className="font-semibold text-gray-900">Start from scratch</span>
          <Input
            className="flex-1 min-w-[220px]"
            placeholder="Automation name, e.g. Welcome series"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Automation name"
          />
          <Button type="submit" disabled={create.isPending || !name.trim()}>
            {create.isPending ? "Creating..." : "Create"}
          </Button>
        </form>
        <div className="mt-3">
          <FormErrorBanner error={create.error?.message} />
        </div>
      </Card>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Templates</h2>
        <TemplateGallery templates={WORKFLOW_TEMPLATES} onOpen={(t) => { fromTemplate.reset(); setPreview(t); }} />
      </section>

      <TemplatePreviewDialog
        template={preview}
        onClose={() => setPreview(null)}
        isCreating={fromTemplate.isPending}
        error={fromTemplate.error?.message}
        onUse={(templateName) =>
          preview &&
          fromTemplate.mutate({ templateId: preview.id, name: templateName }, { onSuccess: (workflow) => open(workflow.id) })
        }
      />
    </div>
  );
}
