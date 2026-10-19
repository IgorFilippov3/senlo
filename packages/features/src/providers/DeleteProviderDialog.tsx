"use client";

import React from "react";
import { Button, Dialog } from "@senlo/ui";

export interface DeleteProviderDialogProps {
  /** Which list the provider is from; only changes the wording. */
  kind: "email" | "ai";
  name: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function DeleteProviderDialog({
  kind,
  name,
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
}: DeleteProviderDialogProps) {
  const noun = kind === "ai" ? "AI Provider" : "Provider";

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      disableAnimation={true}
      title={kind === "ai" ? "Delete AI Provider" : "Delete Email Provider"}
      description={`Are you sure you want to delete "${name}"? This action cannot be undone.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : `Delete ${noun}`}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-zinc-500">
        This will permanently remove the {kind === "ai" ? "AI provider" : "provider"} configuration.
      </p>
    </Dialog>
  );
}
