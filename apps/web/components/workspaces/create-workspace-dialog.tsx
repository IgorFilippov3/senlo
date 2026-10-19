"use client";

import { CreateWorkspaceDialog as SharedCreateWorkspaceDialog } from "@senlo/features";
import { useCreateProject } from "apps/web/queries/projects";

interface CreateWorkspaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Registered as CREATE_WORKSPACE. */
export default function CreateWorkspaceDialog({ isOpen, onClose }: CreateWorkspaceDialogProps) {
  const create = useCreateProject();

  return (
    <SharedCreateWorkspaceDialog
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={(values) => create.mutate(values, { onSuccess: onClose })}
      isLoading={create.isPending}
      error={create.error?.message}
    />
  );
}
