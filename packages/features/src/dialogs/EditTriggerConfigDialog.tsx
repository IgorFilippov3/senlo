// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { useProjectTemplates, useUpdateTriggeredCampaign } from "../data";
import { EditTriggerDialog } from "../triggers";
import type { DialogControlProps } from "../shared/dialogs";
import type { SenloDialogProps } from "./registry";

export default function EditTriggerConfigDialog({
  campaign,
  project,
  isOpen,
  onClose,
}: SenloDialogProps["EDIT_TRIGGER_CONFIG"] & DialogControlProps) {
  const { data: templates = [] } = useProjectTemplates(project.id);
  const update = useUpdateTriggeredCampaign(campaign.id);

  // Clears a failed save, so the dialog does not reopen with an old error.
  const close = () => {
    update.reset();
    onClose();
  };

  const handleSave = async (formData: FormData) => {
    try {
      await update.mutateAsync(Object.fromEntries(formData));
      close();
    } catch {
      // Shown in the dialog from `update.error`.
    }
  };

  return (
    <EditTriggerDialog
      campaign={campaign}
      project={project}
      templates={templates}
      isOpen={isOpen}
      onClose={close}
      onSave={handleSave}
      isSaving={update.isPending}
      error={update.error?.message}
    />
  );
}
