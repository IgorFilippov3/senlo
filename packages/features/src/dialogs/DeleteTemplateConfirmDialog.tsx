// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { useDeleteTemplate } from "../data";
import { DeleteTemplateDialog } from "../templates";
import type { DialogControlProps } from "../shared/dialogs";
import type { SenloDialogProps } from "./registry";

export default function DeleteTemplateConfirmDialog({
  template,
  projectId,
  isOpen,
  onClose,
}: SenloDialogProps["DELETE_TEMPLATE"] & DialogControlProps) {
  const remove = useDeleteTemplate();

  return (
    <DeleteTemplateDialog
      template={template}
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() => remove.mutate({ projectId, templateId: template.id }, { onSuccess: onClose })}
      isDeleting={remove.isPending}
      error={remove.error?.message}
    />
  );
}
