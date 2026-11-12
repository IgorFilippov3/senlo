"use client";

import React from "react";
import { Button, Dialog } from "@senlo/ui";
import { FormErrorBanner } from "../shared/FormErrorBanner";
import { ProviderSelect } from "../workspaces/WorkspaceFields";

export interface DeleteProviderDialogProps {
  /** Which list the provider is from; only changes the wording. */
  kind: "email" | "ai";
  name: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
  /** Why the last attempt failed. */
  error?: string | null;
  /** Email only: the workspaces that send through it now, and what they switch to. */
  replacement?: ProviderReplacementProps;
}

export interface ProviderReplacementProps {
  /** Names of the workspaces that use the provider. Empty: nothing to choose. */
  usedBy: string[];
  /** The other email providers they can switch to. */
  options: { id: number; name: string; type: string }[];
  /** null: leave them without a provider (sending disabled). */
  value: number | null;
  onChange: (id: number | null) => void;
}

export function DeleteProviderDialog({
  kind,
  name,
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
  error,
  replacement,
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
      {replacement && replacement.usedBy.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-zinc-700">
            {replacement.usedBy.length === 1 ? "This workspace sends" : "These workspaces send"} through it:{" "}
            <span className="font-medium">{replacement.usedBy.join(", ")}</span>. Switch{" "}
            {replacement.usedBy.length === 1 ? "it" : "them"} to:
          </p>
          <ProviderSelect
            value={replacement.value}
            onChange={replacement.onChange}
            noneLabel="No provider (sending disabled)"
            providers={replacement.options}
          />
        </div>
      )}
      <div className="mt-4">
        <FormErrorBanner error={error} />
      </div>
    </Dialog>
  );
}
