import { getWorkflow } from "../actions";
import { WorkflowEditorClient } from "./editor-client";
import { notFound } from "next/navigation";

export default async function WorkflowEditorPage({
  params,
}: {
  params: Promise<{ id: string; workflowId: string }>;
}) {
  const { id, workflowId } = await params;
  const result = await getWorkflow(parseInt(workflowId));

  if (!result.success) {
    notFound();
  }

  return (
    <div className="h-screen w-full overflow-hidden">
      <WorkflowEditorClient
        initialWorkflow={result.data.workflow}
        initialNodes={result.data.nodes}
        initialEdges={result.data.edges}
      />
    </div>
  );
}
