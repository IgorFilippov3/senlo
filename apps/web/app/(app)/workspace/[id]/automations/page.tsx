import { listWorkflows } from "./actions";
import { Button } from "@senlo/ui";
import { PageHeader } from "@senlo/ui";
import { EmptyState } from "@senlo/ui";
import { GitBranch, Plus } from "lucide-react";
import Link from "next/link";
import { WorkflowListClient } from "./WorkflowListClient";

export default async function AutomationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = parseInt(id);
  const result = await listWorkflows(projectId);

  const workflows = result.success ? result.data : [];

  return (
    <div className="max-w-7xl mx-auto py-10 px-8 space-y-8">
      <PageHeader
        title="Automations"
        description="Build automated email sequences and lifecycle triggers."
        actions={
          <Link href={`/workspace/${id}/automations/new`}>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Automation
            </Button>
          </Link>
        }
      />

      {workflows.length === 0 ? (
        <EmptyState
          icon={<GitBranch className="w-12 h-12" />}
          title="No automations yet"
          description="Create your first automated sequence to engage with your customers."
          action={
            <Link href={`/workspace/${id}/automations/new`}>
              <Button>Create Automation</Button>
            </Link>
          }
        />
      ) : (
        <WorkflowListClient workflows={workflows} workspaceId={id} />
      )}
    </div>
  );
}
