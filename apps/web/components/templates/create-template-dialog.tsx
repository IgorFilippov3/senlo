"use client";

import {
  CreateTemplateDialog as SharedCreateTemplateDialog,
  useCreateTemplate,
  type CreateTemplateValues,
} from "@senlo/features";

interface CreateTemplateDialogProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateTemplateDialog({
  projectId,
  isOpen,
  onClose,
}: CreateTemplateDialogProps) {
  const create = useCreateTemplate();

  // Clears a failed attempt, so the dialog does not reopen with an old error.
  const close = () => {
    create.reset();
    onClose();
  };

  function handleSubmit(values: CreateTemplateValues) {
    create.mutate({ projectId, values }, { onSuccess: close });
  }

  return (
    <SharedCreateTemplateDialog
      isOpen={isOpen}
      onClose={close}
      onSubmit={handleSubmit}
      isLoading={create.isPending}
      error={create.error?.message}
    />
  );
}
