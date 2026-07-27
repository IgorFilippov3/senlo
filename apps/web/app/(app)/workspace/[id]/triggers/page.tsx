import { PageHeader, Button } from "@senlo/ui";
import { Plus } from "lucide-react";
import Link from "next/link";
import { TriggersList } from "apps/web/components/campaigns-list";

export default async function TriggersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  return (
    <main className="max-w-7xl mx-auto py-10 px-8">
      <PageHeader
        title="Email Triggers"
        description="Monitor and manage all your email triggers in one place."
        actions={
          <Link href={`/workspace/${projectId}/triggers/new`}>
            <Button>
              <Plus size={16} />
              New Trigger
            </Button>
          </Link>
        }
      />

      <TriggersList showFilters={true} projectId={projectId} />
    </main>
  );
}
