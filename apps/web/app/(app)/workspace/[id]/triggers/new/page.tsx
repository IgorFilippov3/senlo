import { notFound } from "next/navigation";
import { getWorkspace } from "../../../actions";
import { TriggerWizard } from "@/components/triggers/trigger-wizard";

export const dynamic = "force-dynamic";

export default async function NewTriggerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId)) notFound();

  const result = await getWorkspace(projectId);
  if (!result.success) {
    if (result.error.code === "NOT_FOUND") notFound();
    throw new Error(result.error.message);
  }

  return <TriggerWizard projectId={projectId} projectName={result.data.name} />;
}
