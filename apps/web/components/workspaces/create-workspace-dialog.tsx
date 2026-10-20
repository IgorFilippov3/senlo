"use client";

import { CreateWorkspaceDialog as SharedCreateWorkspaceDialog, useCreateProject } from "@senlo/features";

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
