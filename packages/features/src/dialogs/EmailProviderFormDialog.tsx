// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import type { PublicEmailProvider } from "@senlo/core";
import { useCreateProvider, useUpdateProvider } from "../data";
import { EmailProviderDialog, type EmailProviderValues } from "../providers";
import type { DialogControlProps } from "../shared/dialogs";

/** Both ADD_PROVIDER and EDIT_PROVIDER: edits `provider`, creates one without it. */
export default function EmailProviderFormDialog({
  provider,
  isOpen,
  onClose,
}: { provider?: PublicEmailProvider } & DialogControlProps) {
  const create = useCreateProvider();
  const update = useUpdateProvider();
  const mutation = provider ? update : create;

  const handleSubmit = (values: EmailProviderValues) => {
    const options = { onSuccess: onClose };
    if (provider) update.mutate({ id: provider.id, values }, options);
    else create.mutate(values, options);
  };

  return (
    <EmailProviderDialog
      provider={provider}
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      isSubmitting={mutation.isPending}
      error={mutation.error?.message}
    />
  );
}
