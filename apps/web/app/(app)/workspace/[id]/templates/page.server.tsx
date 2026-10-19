"use client";

import { PageHeader, Button } from "@senlo/ui";
import Link from "next/link";
import { useProject } from "apps/web/queries/projects";
import { useProjectTemplates } from "apps/web/queries/templates";
import { TemplatesList, PageSkeleton, ErrorScreen } from "@senlo/features";
import { renderLink } from "apps/web/components/link";
import { useDialogStore } from "apps/web/providers/dialogs/store";
import { Settings2, Plus } from "lucide-react";
import { EmailTemplate } from "@senlo/core";

interface ProjectPageClientProps {
  projectId: string;
}

export default function ProjectPage({ projectId }: ProjectPageClientProps) {
  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
  } = useProject(Number(projectId));

  const openDialog = useDialogStore((state) => state.open);

  const { data: templates = [], isLoading: templatesLoading } =
    useProjectTemplates({
      projectId: project?.id || 0,
    });

  if (projectLoading || templatesLoading) {
    return <PageSkeleton variant="cards" />;
  }

  if (projectError || !project) {
    return (
      <ErrorScreen
        title="Workspace not found"
        description={
          projectError?.message || "The workspace you are looking for does not exist."
        }
        back={{ href: "/workspaces", label: "Back to workspaces" }}
        renderLink={renderLink}
      />
    );
  }

  const handleDeleteTemplate = (template: EmailTemplate) => {
    openDialog("DELETE_TEMPLATE", { template, projectId: project.id });
  };

  const renderTemplateLink = (id: number, children: React.ReactNode) => (
    <Link href={`/editor/${id}`}>{children}</Link>
  );

  return (
    <main className="max-w-7xl mx-auto py-10 px-8">
      <div className="mb-6">
        <Link
          href="/workspaces"
          className="text-sm text-zinc-500 hover:text-zinc-800 flex items-center gap-1 transition-colors"
        >
          ← Back to Workspaces
        </Link>
      </div>

      <PageHeader
        title="Email Templates"
        description="Design and manage your email content and layouts."
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() =>
openDialog("EDIT_WORKSPACE", { project })
              }
            >
              <Settings2 size={16} />
              Edit Workspace
            </Button>
            <Button
              onClick={() => openDialog("CREATE_TEMPLATE", { projectId })}
            >
              <Plus size={16} />
              New Template
            </Button>
          </div>
        }
      />

      <TemplatesList
        templates={templates}
        onDelete={handleDeleteTemplate}
        renderLink={renderTemplateLink}
      />
    </main>
  );
}
