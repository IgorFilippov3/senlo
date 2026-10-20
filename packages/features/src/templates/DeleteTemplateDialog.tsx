"use client";

import React from "react";
import { Button, Dialog } from "@senlo/ui";
import type { EmailTemplate } from "@senlo/core";
import { FormErrorBanner } from "../shared/FormErrorBanner";

export interface DeleteTemplateDialogProps {
  template: EmailTemplate;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
  /** Server message from the last attempt. */
  error?: string | null;
}

export function DeleteTemplateDialog({
  template,
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
  error,
}: DeleteTemplateDialogProps) {
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
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete Template"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-zinc-500">
          The template will be permanently removed from this project.
        </p>
        <FormErrorBanner error={error} />
      </div>
    </Dialog>
  );
}
