import { notFound } from "next/navigation";
import { host } from "@/lib/host";
import { WorkflowEditorScreen } from "@senlo/features/workflow-editor";

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
  return <WorkflowEditorScreen workflow={workflow} nodes={nodes} edges={edges} />;
}
