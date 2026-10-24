import { WorkflowEditorScreen } from "@senlo/features/workflow-editor";
import { loadWorkflowPage, type WorkflowPageProps } from "@senlo/next";
import { host } from "@/lib/host";

export default async function WorkflowEditorPage(props: WorkflowPageProps) {
  return <WorkflowEditorScreen {...await loadWorkflowPage(host, props)} />;
}
