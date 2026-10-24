import { TriggerDetailsScreen } from "@senlo/features";
import { loadTriggerPage, type TriggerPageProps } from "@senlo/next";
import { host } from "@/lib/host";

export default async function TriggerDetailsPage(props: TriggerPageProps) {
  return <TriggerDetailsScreen {...await loadTriggerPage(host, props)} />;
}
