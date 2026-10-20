"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { EmailTemplate } from "@senlo/core";
import { PageHeader, Button } from "@senlo/ui";
import {
  ErrorScreen,
  PageSkeleton,
  TemplatesList,
  useCurrentWorkspace,
  useProjectTemplates,
} from "@senlo/features";
import { useDialogs } from "@/providers/dialogs/store";

export function TemplatesPage() {
  const workspace = useCurrentWorkspace();
  const { data: templates = [], isLoading, error, refetch } = useProjectTemplates(workspace.id);
  const { open: openDialog } = useDialogs();

  if (isLoading) return <PageSkeleton variant="cards" />;
  if (error) {
    return (
      <ErrorScreen
        title="Failed to load templates"
        description={error.message}
        onRetry={() => void refetch()}
      />
    );
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
        onDelete={(template: EmailTemplate) =>
          openDialog("DELETE_TEMPLATE", { template, projectId: workspace.id })
        }
        renderLink={(id, children) => <Link href={`/editor/${id}`}>{children}</Link>}
      />
    </main>
  );
}
