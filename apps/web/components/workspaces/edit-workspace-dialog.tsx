"use client";

import type { Project } from "@senlo/core";
import {
  EditWorkspaceDialog as SharedEditWorkspaceDialog,
  useAiProviders,
  useUpdateProject,
  useProviders,
} from "@senlo/features";
import { renderProvidersLink } from "./providers-link";

interface EditWorkspaceDialogProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
}

/** Registered as EDIT_WORKSPACE. */
export default function EditWorkspaceDialog({ project, isOpen, onClose }: EditWorkspaceDialogProps) {
  const { data: providers = [] } = useProviders();
  const { data: aiProviders = [] } = useAiProviders();
  const update = useUpdateProject();

  return (
    <SharedEditWorkspaceDialog
      workspace={project}
      emailProviders={providers}
      aiProviders={aiProviders}
      renderProvidersLink={renderProvidersLink}
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={(values) => update.mutate({ projectId: project.id, values }, { onSuccess: onClose })}
      isSaving={update.isPending}
      error={update.error?.message}
    />
  );
}
