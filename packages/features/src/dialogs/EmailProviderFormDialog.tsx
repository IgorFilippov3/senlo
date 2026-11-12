// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useMemo, useState } from "react";
import type { PublicEmailProvider } from "@senlo/core";
import { useCreateProvider, useProjects, useProviders, useUpdateProvider } from "../data";
import { EmailProviderDialog, type EmailProviderValues, type ProviderWorkspaceChoice } from "../providers";
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
  const { data: projects } = useProjects();
  const { data: providers } = useProviders();

  const workspaces = useMemo<ProviderWorkspaceChoice[] | undefined>(() => {
    if (!projects || !providers) return undefined;
    const names = new Map(providers.map((p) => [p.id, p.name]));
    return projects.map((w) => ({
      id: w.id,
      name: w.name,
      providerId: w.providerId ?? null,
      providerName: w.providerId ? names.get(w.providerId) ?? null : null,
    }));
  }, [projects, providers]);

  const [savedWarning, setSavedWarning] = useState<string | null>(null);

  const handleSubmit = (values: EmailProviderValues) => {
    const options = {
      onSuccess: (saved: { keyCheck?: { status: string; message?: string } }) => {
        if (saved.keyCheck?.status === "unknown") setSavedWarning(saved.keyCheck.message ?? null);
        else onClose();
      },
    };
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
      workspaces={workspaces}
      savedWarning={savedWarning}
    />
  );
}
