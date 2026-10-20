"use client";

import { AiProviderDialog, useCreateAiProvider } from "@senlo/features";

export default function AddAiProviderDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const create = useCreateAiProvider();

  return (
    <AiProviderDialog
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={(formData) =>
        create.mutate(Object.fromEntries(formData), { onSuccess: onClose })
      }
      isSubmitting={create.isPending}
      error={create.error?.message}
    />
  );
}
