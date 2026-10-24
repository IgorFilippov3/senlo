// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { useCreateAiProvider } from "../data";
import { AiProviderDialog } from "../providers";
import type { DialogControlProps } from "../shared/dialogs";

export default function AiProviderFormDialog({ isOpen, onClose }: DialogControlProps) {
  const create = useCreateAiProvider();

  return (
    <AiProviderDialog
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={(values) => create.mutate(values, { onSuccess: onClose })}
      isSubmitting={create.isPending}
      error={create.error?.message}
    />
  );
}
