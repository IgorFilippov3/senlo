"use client";

import { AiProviderDialog } from "@senlo/features";
import { useCreateAiProvider } from "apps/web/queries/ai-providers";

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
      onSubmit={(formData) => create.mutate(formData, { onSuccess: onClose })}
      isSubmitting={create.isPending}
      error={create.error?.message}
    />
  );
}
