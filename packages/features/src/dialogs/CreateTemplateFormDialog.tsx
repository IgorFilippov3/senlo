// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { useCreateTemplate } from "../data";
import { CreateTemplateDialog, type CreateTemplateValues } from "../templates";
import type { DialogControlProps } from "../shared/dialogs";
import type { SenloDialogProps } from "./registry";

export default function CreateTemplateFormDialog({
  projectId,
  isOpen,
  onClose,
}: SenloDialogProps["CREATE_TEMPLATE"] & DialogControlProps) {
  const create = useCreateTemplate();

  // Clears a failed attempt, so the dialog does not reopen with an old error.
  const close = () => {
    create.reset();
    onClose();
  };

  return (
    <CreateTemplateDialog
      isOpen={isOpen}
      onClose={close}
      onSubmit={(values: CreateTemplateValues) => create.mutate({ projectId, values }, { onSuccess: close })}
      isLoading={create.isPending}
      error={create.error?.message}
    />
  );
}
