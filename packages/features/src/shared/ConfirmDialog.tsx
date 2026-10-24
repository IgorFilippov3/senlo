// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { Button, Dialog } from "@senlo/ui";
import { FormErrorBanner } from "./FormErrorBanner";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  /** The confirm button's label, e.g. "Delete Key". */
  confirmLabel: string;
  /** Shown on the confirm button while the action runs. */
  pendingLabel?: string;
  isPending?: boolean;
  /** Why the last attempt failed. */
  error?: string | null;
  /** A red confirm button, for deleting. Defaults to true. */
  destructive?: boolean;
  children?: React.ReactNode;
}

/** A yes/no question before an action that cannot be undone; in place of `confirm()`. */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  pendingLabel = "Working...",
  isPending = false,
  error,
  destructive = true,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      disableAnimation={true}
      title={title}
      description={description}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant={destructive ? "destructive" : "primary"} onClick={onConfirm} disabled={isPending}>
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      }
    >
      {children}
      <FormErrorBanner error={error} />
    </Dialog>
  );
}
