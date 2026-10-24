// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { Plus } from "lucide-react";
import type { EmailTemplate } from "@senlo/core";
import { Button, PageHeader } from "@senlo/ui";
import { useProjectTemplates } from "../data";
import { useSenloDialogs } from "../dialogs/registry";
import { useSenloNavigation } from "../layout/navigation-context";
import { ErrorScreen } from "../shared/ErrorScreen";
import { PageSkeleton } from "../shared/Skeletons";
import { useCurrentWorkspace } from "../workspaces/WorkspaceScope";
import { TemplatesList } from "./TemplatesList";

/** The workspace's templates: list, create, delete, open in the editor. */
export function TemplatesScreen() {
  const workspace = useCurrentWorkspace();
  const { paths, renderLink } = useSenloNavigation();
  const { data: templates = [], isLoading, error, refetch } = useProjectTemplates(workspace.id);
  const { open: openDialog } = useSenloDialogs();

  if (isLoading) return <PageSkeleton variant="cards" />;
  if (error) {
    return <ErrorScreen title="Failed to load templates" description={error.message} onRetry={() => void refetch()} />;
  }

  return (
    <main className="max-w-7xl mx-auto py-10 px-8">
      <PageHeader
        title="Email Templates"
        description="Design and manage your email content and layouts."
        actions={
          <Button onClick={() => openDialog("CREATE_TEMPLATE", { projectId: workspace.id })}>
            <Plus size={16} />
            New Template
          </Button>
        }
      />

      <TemplatesList
        templates={templates}
        onDelete={(template: EmailTemplate) => openDialog("DELETE_TEMPLATE", { template, projectId: workspace.id })}
        renderLink={(id, children) => renderLink(paths.editor(id), children, "")}
      />
    </main>
  );
}
