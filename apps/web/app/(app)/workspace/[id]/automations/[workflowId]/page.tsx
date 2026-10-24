import { notFound } from "next/navigation";
import { host } from "@/lib/host";
import { WorkflowEditor } from "@/components/automations/workflow-editor";

export default async function WorkflowEditorPage({
  params,
}: {
  params: Promise<{ workflowId: string }>;
}) {
  const { workflowId } = await params;
  const graph = await host
    .requireUserId()
    .then((userId) => host.getServices().workflow.getGraph(userId, Number(workflowId)))
    .catch(() => null);
  if (!graph) notFound();

  const { workflow, nodes, edges } = graph;
  return <WorkflowEditor workflow={workflow} nodes={nodes} edges={edges} />;
}
