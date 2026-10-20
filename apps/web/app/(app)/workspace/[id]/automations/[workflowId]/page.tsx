import { notFound } from "next/navigation";
import { getWorkflow } from "../actions";
import { WorkflowEditor } from "@/components/automations/workflow-editor";

export default async function WorkflowEditorPage({
  params,
}: {
  params: Promise<{ workflowId: string }>;
}) {
  const { workflowId } = await params;
  const result = await getWorkflow(Number(workflowId));
  if (!result.success) notFound();

  const { workflow, nodes, edges } = result.data;
  return <WorkflowEditor workflow={workflow} nodes={nodes} edges={edges} />;
}
