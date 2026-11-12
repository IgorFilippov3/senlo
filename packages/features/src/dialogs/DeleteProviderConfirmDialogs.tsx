// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { useDeleteAiProvider, useDeleteProvider, useProjects, useProviders } from "../data";
import { DeleteProviderDialog, type ProviderReplacementProps } from "../providers";
import type { DialogControlProps } from "../shared/dialogs";
import type { SenloDialogProps } from "./registry";

type Props = SenloDialogProps["DELETE_PROVIDER"] & DialogControlProps;

function DeleteDialog({
  kind,
  mutation,
  name,
  isOpen,
  onClose,
  onConfirm,
  replacement,
}: Omit<Props, "providerId"> & {
  kind: "email" | "ai";
  mutation: Pick<UseMutationResult<number, Error, never>, "reset" | "isPending" | "error">;
  onConfirm: (onSuccess: () => void) => void;
  replacement?: ProviderReplacementProps;
}) {
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
      onConfirm={() => onConfirm(close)}
      replacement={replacement}
    />
  );
}

/**
 * Names the workspaces that send through the provider and lets the user
 * switch them to another one (the first other provider by default) or leave
 * them without one.
 */
export function DeleteEmailProviderConfirmDialog(props: Props) {
  const mutation = useDeleteProvider();
  const { data: projects = [] } = useProjects();
  const { data: providers = [] } = useProviders();
  const usedBy = projects.filter((w) => w.providerId === props.providerId).map((w) => w.name);
  const options = providers.filter((p) => p.id !== props.providerId);
  const [choice, setChoice] = useState<number | null | undefined>(undefined);
  const value = choice === undefined ? options[0]?.id ?? null : choice;

  return (
    <DeleteDialog
      kind="email"
      mutation={mutation}
      {...props}
      replacement={{ usedBy, options, value, onChange: setChoice }}
      onConfirm={(onSuccess) =>
        mutation.mutate(
          { providerId: props.providerId, replacementId: usedBy.length > 0 ? value : null },
          { onSuccess },
        )
      }
    />
  );
}

export function DeleteAiProviderConfirmDialog(props: Props) {
  const mutation = useDeleteAiProvider();
  return (
    <DeleteDialog
      kind="ai"
      mutation={mutation}
      {...props}
      onConfirm={(onSuccess) => mutation.mutate(props.providerId, { onSuccess })}
    />
  );
}
