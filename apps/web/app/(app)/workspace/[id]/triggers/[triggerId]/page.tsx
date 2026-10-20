import { notFound } from "next/navigation";
import { getCampaignDetails } from "../actions";
import { getConfig } from "@/lib/config";
import { TriggerDetails } from "@/components/triggers/trigger-details";

interface TriggerDetailsPageProps {
  params: Promise<{ id: string; triggerId: string }>;
}

export default async function TriggerDetailsPage({ params }: TriggerDetailsPageProps) {
  const { triggerId } = await params;
  const id = Number(triggerId);
  if (isNaN(id)) notFound();

  const details = await getCampaignDetails(id);
  if (!details) notFound();

  const { appUrl, defaultFromEmail } = getConfig();

  return (
    <TriggerDetails
      details={details}
      apiEndpointUrl={`${appUrl}/api/triggered`}
      defaultFromEmail={defaultFromEmail}
    />
  );
}
