import Link from "next/link";
import { Button, PageHeader } from "@senlo/ui";
import { Plus } from "lucide-react";
import { WorkflowsList } from "apps/web/components/automations/workflows-list";

export default async function AutomationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

      <WorkflowsList projectId={Number(id)} />
    </div>
  );
}
