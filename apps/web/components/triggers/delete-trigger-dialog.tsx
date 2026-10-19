"use client";

import type { Campaign } from "@senlo/core";
import { DeleteTriggerDialog as SharedDeleteTriggerDialog } from "@senlo/features";
import { useDeleteCampaign } from "apps/web/queries/campaigns";

interface DeleteTriggerDialogProps {
  campaign: Campaign;
  isOpen: boolean;
  onClose: () => void;
}

export default function DeleteTriggerDialog({ campaign, isOpen, onClose }: DeleteTriggerDialogProps) {
  const { mutate: deleteTrigger, isPending } = useDeleteCampaign();

  const confirm = () =>
    deleteTrigger(campaign.id, {
      onSuccess: onClose,
      onError: () => alert("Failed to delete trigger. Please try again."),
    });

  return (
    <SharedDeleteTriggerDialog
      campaign={campaign}
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={confirm}
      isDeleting={isPending}
    />
  );
}
