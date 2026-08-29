"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@senlo/ui";
import { Card } from "@senlo/ui";
import { Badge } from "@senlo/ui";
import { Dialog } from "@senlo/ui";
import { GitBranch, Play, Pause, Trash2 } from "lucide-react";
import Link from "next/link";
import { updateWorkflowStatus, deleteWorkflow } from "./actions";
import { Workflow } from "@senlo/core";

interface WorkflowListClientProps {
  workflows: Workflow[];
  workspaceId: string;
}

export const WorkflowListClient = ({
  workflows: initialWorkflows,
  workspaceId,
}: WorkflowListClientProps) => {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggleStatus = async (workflow: Workflow) => {
    const newStatus = workflow.status === "ACTIVE" ? "DRAFT" : "ACTIVE";

    startTransition(async () => {
      const result = await updateWorkflowStatus(workflow.id, newStatus);
      if (result.success) {
        setWorkflows((prev) =>
          prev.map((w) =>
            w.id === workflow.id ? { ...w, status: newStatus } : w,
          ),
        );
      }
    });
  };

  const handleDelete = async () => {
    if (!isDeleting) return;

    startTransition(async () => {
      const result = await deleteWorkflow(isDeleting);
      if (result.success) {
        setWorkflows((prev) => prev.filter((w) => w.id !== isDeleting));
        setIsDeleting(null);
      }
    });
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workflows.map((workflow) => (
          <Card
            key={workflow.id}
            className="p-6 flex flex-col justify-between border-gray-200 shadow-sm hover:shadow-md transition-all rounded-xl relative overflow-hidden"
          >
            {isPending && (
              <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center backdrop-blur-[1px]" />
            )}
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
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {workflow.name}
              </h3>
              <p className="text-gray-500 text-sm mb-6 line-clamp-2 leading-relaxed">
                {workflow.description || "No description provided."}
              </p>
            </div>
            <div className="flex gap-2 mt-auto pt-5 border-t border-gray-50">
              <Link
                href={`/workspace/${workspaceId}/automations/${workflow.id}`}
                className="flex-1"
              >
                <Button variant="outline" className="w-full font-semibold">
                  Edit Flow
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-gray-100"
                onClick={() => handleToggleStatus(workflow)}
                disabled={isPending}
                title={workflow.status === "ACTIVE" ? "Pause" : "Start"}
              >
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
                onClick={() => setIsDeleting(workflow.id)}
                disabled={isPending}
                title="Delete"
              >
                <Trash2 size={18} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog
        isOpen={isDeleting !== null}
        onClose={() => setIsDeleting(null)}
        title="Delete Automation"
        description="Are you sure you want to delete this automation? This action cannot be undone and all associated execution history will be lost."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete Automation"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-500">
          This will permanently remove the automation and stop all active
          journeys.
        </p>
      </Dialog>
    </>
  );
};
