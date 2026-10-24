import { notFound } from "next/navigation";
import { NotFoundError } from "@senlo/core";
import { host } from "@/lib/host";
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

  const userId = await host.requireUserId();
  const project = await host
    .getServices()
    .project.require(userId, projectId, "read")
    .catch((error) => {
      if (error instanceof NotFoundError) notFound();
      throw error;
    });

  return <TriggerWizard projectId={projectId} projectName={project.name} />;
}
