"use client";

import { PageHeader, Button } from "@senlo/ui";
import Link from "next/link";
import { useProject } from "apps/web/queries/projects";
import { useProjectTemplates } from "apps/web/queries/templates";
import { useProviders } from "apps/web/queries/providers";
import { useAiProviders } from "apps/web/queries/ai-providers";
import { TemplatesList } from "@senlo/features";
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
  } = useProject(projectId);

  const openDialog = useDialogStore((state) => state.open);

  const { data: templates = [], isLoading: templatesLoading } =
    useProjectTemplates({
      projectId: project?.id || 0,
    });

  const { data: providers = [], isLoading: providersLoading } = useProviders();

  const { data: aiProviders = [], isLoading: aiProvidersLoading } =
    useAiProviders();

  if (
    projectLoading ||
    providersLoading ||
    aiProvidersLoading ||
    templatesLoading
  ) {
    return (
      <main className="max-w-7xl mx-auto py-10 px-8">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      </main>
    );
  }

  if (projectError || !project) {
    return (
      <main className="max-w-7xl mx-auto py-10 px-8">
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
            <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              !
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">
              Workspace not found
            </h1>
            <p className="text-gray-600">
              {projectError?.message ||
                "The workspace you are looking for does not exist."}
            </p>
          </div>
        </div>
      </main>
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
                openDialog("EDIT_WORKSPACE", {
                  project,
                  providers,
                  aiProviders,
                })
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
