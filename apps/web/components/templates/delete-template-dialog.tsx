"use client";

import type { EmailTemplate } from "@senlo/core";
import { DeleteTemplateDialog as SharedDeleteTemplateDialog, useDeleteTemplate } from "@senlo/features";

interface DeleteTemplateDialogProps {
  template: EmailTemplate;
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function DeleteTemplateDialog({
  template,
  projectId,
  isOpen,
  onClose,
}: DeleteTemplateDialogProps) {
  const remove = useDeleteTemplate();

  return (
    <SharedDeleteTemplateDialog
      template={template}
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() =>
        remove.mutate({ projectId, templateId: template.id }, { onSuccess: onClose })
      }
      isDeleting={remove.isPending}
      error={remove.error?.message}
    />
  );
}
