"use client";

import { CreateTemplateDialog as SharedCreateTemplateDialog } from "@senlo/features";
import { useCreateTemplate } from "apps/web/queries/templates";
import { logger } from "apps/web/lib/logger";

interface CreateTemplateDialogProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateTemplateDialog({
  projectId,
  isOpen,
  onClose,
}: CreateTemplateDialogProps) {
  const { mutate: createTemplate, isPending: isCreating } = useCreateTemplate();

  function handleSubmit(formData: FormData) {
    createTemplate(
      { projectId, formData },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (error) => {
          logger.error("Failed to create template", {
            projectId,
            error: error instanceof Error ? error.message : String(error),
          });
          alert("Failed to create template. Please try again.");
        },
      },
    );
  }

  return (
    <SharedCreateTemplateDialog
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      isLoading={isCreating}
    />
  );
}
