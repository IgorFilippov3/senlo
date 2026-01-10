"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface CampaignPollingProps {
  campaignId: number;
  status: string;
}

export function CampaignPolling({ campaignId, status }: CampaignPollingProps) {
  const router = useRouter();

  useEffect(() => {
    const shouldPoll = status === "SENDING" || status === "COMPLETED";

    if (!shouldPoll) return;

    const interval = setInterval(() => {
      router.refresh();
    }, 3000);

    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 120000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [campaignId, status, router]);

  return null;
}
