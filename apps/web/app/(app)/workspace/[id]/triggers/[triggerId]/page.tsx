import { notFound } from "next/navigation";
import { getConfig } from "@/lib/config";
import { host } from "@/lib/host";
import { TriggerDetailsScreen } from "@senlo/features";

interface TriggerDetailsPageProps {
  params: Promise<{ id: string; triggerId: string }>;
}

export default async function TriggerDetailsPage({ params }: TriggerDetailsPageProps) {
  const { triggerId } = await params;
  const id = Number(triggerId);
  if (isNaN(id)) notFound();

  const userId = await host.requireUserId();
  const details = await host.getServices().campaign.getDetails(userId, id);
  if (!details) notFound();

  const { appUrl, defaultFromEmail } = getConfig();

  return (
    <TriggerDetailsScreen
      details={details}
      apiEndpointUrl={`${appUrl}/api/triggered`}
      defaultFromEmail={defaultFromEmail}
    />
  );
}
