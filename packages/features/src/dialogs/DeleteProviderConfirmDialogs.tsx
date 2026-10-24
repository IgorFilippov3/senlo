// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { useDeleteAiProvider, useDeleteProvider } from "../data";
import { DeleteProviderDialog } from "../providers";
import type { DialogControlProps } from "../shared/dialogs";
import type { SenloDialogProps } from "./registry";

type Props = SenloDialogProps["DELETE_PROVIDER"] & DialogControlProps;

function DeleteDialog({
  kind,
  mutation,
  providerId,
  name,
  isOpen,
  onClose,
}: Props & { kind: "email" | "ai"; mutation: UseMutationResult<number, Error, number> }) {
  // Clears a failed attempt, so the dialog does not reopen with an old error.
  const close = () => {
    mutation.reset();
    onClose();
  };

  return (
    <DeleteProviderDialog
      kind={kind}
      name={name}
      isOpen={isOpen}
      onClose={close}
      isDeleting={mutation.isPending}
      error={mutation.error ? "Failed to delete provider. Please try again." : null}
      onConfirm={() => mutation.mutate(providerId, { onSuccess: close })}
    />
  );
}

export function DeleteEmailProviderConfirmDialog(props: Props) {
  return <DeleteDialog kind="email" mutation={useDeleteProvider()} {...props} />;
}

export function DeleteAiProviderConfirmDialog(props: Props) {
  return <DeleteDialog kind="ai" mutation={useDeleteAiProvider()} {...props} />;
}
