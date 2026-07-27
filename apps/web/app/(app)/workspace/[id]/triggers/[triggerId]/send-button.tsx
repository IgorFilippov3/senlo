"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@senlo/ui";
import { Send } from "lucide-react";
import { sendCampaignAction } from "../actions";
import { queryKeys } from "apps/web/providers/query-keys";

interface SendCampaignButtonProps {
  campaignId: number;
}

export function SendCampaignButton({ campaignId }: SendCampaignButtonProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const sendCampaignMutation = useMutation({
    mutationFn: async () => {
      const result = await sendCampaignAction(campaignId);
      if (!result.success) {
        throw new Error("Failed to send campaign");
      }
      return result;
    },
    onSuccess: (result) => {
      alert(`Successfully sent to ${result.data.sentCount} contacts!`);

      // Invalidate campaigns data to refresh status
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.all,
      });

      // Also refresh the page for server components
      router.refresh();
    },
    onError: (error) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      alert(errorMessage || "Failed to send campaign. Please try again.");

      // Still refresh on error to ensure data consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.all,
      });
      router.refresh();
    },
  });

  const handleSend = async () => {
    if (!window.confirm("Are you sure you want to send this campaign now?"))
      return;
    sendCampaignMutation.mutate();
  };

  return (
    <Button
      size="sm"
      onClick={handleSend}
      disabled={sendCampaignMutation.isPending}
    >
      <Send
        size={16}
        className={sendCampaignMutation.isPending ? "animate-pulse" : ""}
      />
      {sendCampaignMutation.isPending ? "Sending..." : "Send Now"}
    </Button>
  );
}
