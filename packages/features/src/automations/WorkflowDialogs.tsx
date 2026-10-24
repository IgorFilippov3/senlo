"use client";

import React from "react";
import { Button, Dialog } from "@senlo/ui";
import { FormErrorBanner } from "../shared/FormErrorBanner";

export interface DeleteWorkflowDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
  /** Why the last attempt failed. */
  error?: string | null;
}

export function DeleteWorkflowDialog({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
  error,
}: DeleteWorkflowDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Automation"
      description="Are you sure you want to delete this automation? This action cannot be undone and all associated execution history will be lost."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete Automation"}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-gray-500">
        This will permanently remove the automation and stop all active journeys.
      </p>
      <div className="mt-4">
        <FormErrorBanner error={error} />
      </div>
    </Dialog>
  );
}

export interface GoLiveErrorsDialogProps {
  /** Why the workflow cannot go live; the dialog is closed while null. */
  reasons: string[] | null;
  onClose: () => void;
}

export function GoLiveErrorsDialog({ reasons, onClose }: GoLiveErrorsDialogProps) {
  return (
    <Dialog
      isOpen={reasons !== null}
      onClose={onClose}
      title="Cannot go live"
      footer={<Button onClick={onClose}>Got it</Button>}
    >
      <ul className="text-sm text-gray-600 list-disc pl-4 space-y-1">
        {(reasons ?? []).map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </Dialog>
  );
}
