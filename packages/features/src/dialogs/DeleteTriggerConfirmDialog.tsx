// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { useDeleteCampaign } from "../data";
import { DeleteTriggerDialog } from "../triggers";
import type { DialogControlProps } from "../shared/dialogs";
import type { SenloDialogProps } from "./registry";

export default function DeleteTriggerConfirmDialog({
  campaign,
  isOpen,
  onClose,
}: SenloDialogProps["DELETE_TRIGGER"] & DialogControlProps) {
  const { mutate: deleteTrigger, isPending, error, reset } = useDeleteCampaign();

  const close = () => {
    reset();
    onClose();
  };

  return (
    <DeleteTriggerDialog
      campaign={campaign}
      isOpen={isOpen}
      onClose={close}
      onConfirm={() => deleteTrigger(campaign.id, { onSuccess: close })}
      isDeleting={isPending}
      error={error ? "Failed to delete trigger. Please try again." : null}
    />
  );
}
