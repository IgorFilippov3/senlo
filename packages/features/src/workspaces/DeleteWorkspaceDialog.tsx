"use client";

import React from "react";
import { Button, Dialog } from "@senlo/ui";
import { FormErrorBanner } from "../shared";

export interface DeleteWorkspaceDialogProps {
  name: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
  error?: string | null;
}

export function DeleteWorkspaceDialog({
  name,
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
  error,
}: DeleteWorkspaceDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      disableAnimation={true}
      title="Delete Workspace"
      description={`Are you sure you want to delete "${name}"? This action cannot be undone.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete Workspace"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-zinc-500">
          All templates, triggers, automations, contacts and logs in this workspace will be
          permanently removed.
        </p>
        <FormErrorBanner error={error} />
      </div>
    </Dialog>
  );
}
