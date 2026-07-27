"use client";

import { Button, Dialog } from "@senlo/ui";
import { EmailTemplate } from "@senlo/core";
import { logger } from "apps/web/lib/logger";
import { useDeleteTemplate } from "apps/web/queries/templates";

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
  const { mutate: deleteTemplate, isPending: isDeleting } = useDeleteTemplate();

  const confirmDelete = async () => {
    deleteTemplate(
      { projectId: projectId.toString(), templateId: template.id },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (error) => {
          logger.error("Failed to delete template from dialog", {
            templateId: template.id,
            projectId: template.projectId,
            error: error instanceof Error ? error.message : String(error),
          });
          alert("Failed to delete template. Please try again.");
        },
      },
    );
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      disableAnimation={true}
      title="Delete Template"
      description={`Are you sure you want to delete "${template.name}"? This action cannot be undone.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirmDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Template"}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-zinc-500">
        The template will be permanently removed from this project.
      </p>
    </Dialog>
  );
}
