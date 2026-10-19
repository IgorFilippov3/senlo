"use client";

import React from "react";
import { Button, Dialog } from "@senlo/ui";
import type { Campaign } from "@senlo/core";

export interface DeleteTriggerDialogProps {
  campaign: Campaign;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function DeleteTriggerDialog({
  campaign,
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
}: DeleteTriggerDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      disableAnimation={true}
      title="Delete Trigger"
      description={`Are you sure you want to delete "${campaign.name}"? All associated analytics data will be permanently removed. This action cannot be undone.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete Trigger"}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-zinc-500">
        This will permanently remove the trigger and all its history.
      </p>
    </Dialog>
  );
}
