import { listWorkflows } from "./actions";
import { Button } from "@senlo/ui";
import { PageHeader } from "@senlo/ui";
import { Card } from "@senlo/ui";
import { Badge } from "@senlo/ui";
import { EmptyState } from "@senlo/ui";
import { GitBranch, Plus, Play, Pause, Trash2 } from "lucide-react";
import Link from "next/link";

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map((workflow) => (
            <Card
              key={workflow.id}
              className="p-6 flex flex-col justify-between border-gray-200 shadow-sm hover:shadow-md transition-all rounded-xl"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg inline-block text-gray-600">
                    <GitBranch className="w-5 h-5" />
                  </div>
                  <Badge
                    variant={
                      workflow.status === "ACTIVE" ? "success" : "secondary"
                    }
                    className="font-semibold uppercase tracking-wider text-[10px]"
                  >
                    {workflow.status}
                  </Badge>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{workflow.name}</h3>
                <p className="text-gray-500 text-sm mb-6 line-clamp-2 leading-relaxed">
                  {workflow.description || "No description provided."}
                </p>
              </div>
              <div className="flex gap-2 mt-auto pt-5 border-t border-gray-50">
                <Link
                  href={`/workspace/${id}/automations/${workflow.id}`}
                  className="flex-1"
                >
                  <Button variant="outline" className="w-full font-semibold">
                    Edit Flow
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" className="hover:bg-gray-100">
                  {workflow.status === "ACTIVE" ? (
                    <Pause size={18} className="text-gray-600" />
                  ) : (
                    <Play size={18} className="text-gray-600" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
