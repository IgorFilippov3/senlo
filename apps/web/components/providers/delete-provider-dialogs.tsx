"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { DeleteProviderDialog } from "@senlo/features";
import { useDeleteProvider } from "apps/web/queries/providers";
import { useDeleteAiProvider } from "apps/web/queries/ai-providers";

interface DeleteDialogProps {
  providerId: number;
  name: string;
  isOpen: boolean;
  onClose: () => void;
}

function DeleteDialog({
  kind,
  mutation,
  providerId,
  name,
  isOpen,
  onClose,
}: DeleteDialogProps & {
  kind: "email" | "ai";
  mutation: UseMutationResult<number, Error, number>;
}) {
  return (
    <DeleteProviderDialog
      kind={kind}
      name={name}
      isOpen={isOpen}
      onClose={onClose}
      isDeleting={mutation.isPending}
      onConfirm={() =>
        mutation.mutate(providerId, {
          onSuccess: onClose,
          onError: () => alert("Failed to delete provider. Please try again."),
        })
      }
    />
  );
}

export function DeleteEmailProviderDialog(props: DeleteDialogProps) {
  return <DeleteDialog kind="email" mutation={useDeleteProvider()} {...props} />;
}

export function DeleteAiProviderDialog(props: DeleteDialogProps) {
  return <DeleteDialog kind="ai" mutation={useDeleteAiProvider()} {...props} />;
}
