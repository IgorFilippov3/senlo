"use client";

import { Button, Dialog } from "@senlo/ui";
import { Campaign } from "@senlo/core";
import { useDeleteCampaign } from "apps/web/queries/campaigns";
import { logger } from "apps/web/lib/logger";

interface DeleteTriggerDialogProps {
  campaign: Campaign;
  isOpen: boolean;
  onClose: () => void;
}

export default function DeleteTriggerDialog({
  campaign,
  isOpen,
  onClose,
}: DeleteTriggerDialogProps) {
  const { mutate: deleteTrigger, isPending: isDeleting } = useDeleteCampaign();

  const confirmDelete = () => {
    deleteTrigger(campaign.id, {
      onSuccess: () => {
        onClose();
      },
      onError: (error) => {
        logger.error("Failed to delete trigger from dialog", {
          campaignId: campaign.id,
          error: error instanceof Error ? error.message : String(error),
        });
        alert("Failed to delete trigger. Please try again.");
      },
    });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      disableAnimation={true}
      title="Delete Trigger"
      description={`Are you sure you want to delete "${campaign.name}"? All associated analytics data will be permanently removed. This action cannot be undone.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirmDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Trigger"}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-zinc-500">
        This will permanently remove the trigger and all its history.
      </p>
    </Dialog>
  );
}
