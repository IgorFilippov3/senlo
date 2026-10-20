"use client";

import type { PublicEmailProvider } from "@senlo/core";
import {
  EmailProviderDialog as SharedEmailProviderDialog,
  useCreateProvider,
  useUpdateProvider,
} from "@senlo/features";

interface EmailProviderDialogProps {
  /** Edits this provider; creates a new one when absent. */
  provider?: PublicEmailProvider;
  isOpen: boolean;
  onClose: () => void;
}

/** Registered as both ADD_PROVIDER and EDIT_PROVIDER. */
export default function EmailProviderDialog({ provider, isOpen, onClose }: EmailProviderDialogProps) {
  const create = useCreateProvider();
  const update = useUpdateProvider();
  const mutation = provider ? update : create;

  const handleSubmit = (formData: FormData) => {
    const values = Object.fromEntries(formData);
    const options = { onSuccess: onClose };
    if (provider) update.mutate({ id: provider.id, values }, options);
    else create.mutate(values, options);
  };

  return (
    <SharedEmailProviderDialog
      provider={provider}
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      isSubmitting={mutation.isPending}
      error={mutation.error?.message}
    />
  );
}
