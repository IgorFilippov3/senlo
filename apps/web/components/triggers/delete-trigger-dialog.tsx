"use client";

import type { Campaign } from "@senlo/core";
import { DeleteTriggerDialog as SharedDeleteTriggerDialog, useDeleteCampaign } from "@senlo/features";

interface DeleteTriggerDialogProps {
  campaign: Campaign;
  isOpen: boolean;
  onClose: () => void;
}

export default function DeleteTriggerDialog({ campaign, isOpen, onClose }: DeleteTriggerDialogProps) {
  const { mutate: deleteTrigger, isPending, error, reset } = useDeleteCampaign();

  const close = () => {
    reset();
    onClose();
  };
  const confirm = () => deleteTrigger(campaign.id, { onSuccess: close });

  return (
    <SharedDeleteTriggerDialog
      campaign={campaign}
      isOpen={isOpen}
      onClose={close}
      onConfirm={confirm}
      isDeleting={isPending}
      error={error ? "Failed to delete trigger. Please try again." : null}
    />
  );
}
