import { NewWorkflow } from "apps/web/components/automations/new-workflow";

export default async function NewAutomationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NewWorkflow projectId={Number(id)} />;
}
