"use client";

import React from "react";
import type { Workflow } from "@senlo/core";
import { Button, Card, Badge, EmptyState } from "@senlo/ui";
import { GitBranch, Play, Pause, Trash2 } from "lucide-react";

export interface WorkflowListProps {
  workflows: Workflow[];
  isLoading?: boolean;
  /** Id of a workflow with a change in flight; its card is dimmed. */
  busyId?: number | null;
  onToggleStatus: (workflow: Workflow) => void;
  onDelete: (workflow: Workflow) => void;
  /** Wraps the "Edit Flow" button in a link to the editor. */
  renderEditLink: (workflow: Workflow, children: React.ReactNode) => React.ReactNode;
  /** Shown in the empty state, e.g. a link to the create page. */
  emptyAction?: React.ReactNode;
}

export function WorkflowList({
  workflows,
  isLoading,
  busyId,
  onToggleStatus,
  onDelete,
  renderEditLink,
  emptyAction,
}: WorkflowListProps) {
  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-500">Loading automations...</p>
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <EmptyState
        icon={<GitBranch className="w-12 h-12" />}
        title="No automations yet"
        description="Create your first automated sequence to engage with your customers."
        action={emptyAction}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {workflows.map((workflow) => {
        const isActive = workflow.status === "ACTIVE";
        const isBusy = busyId === workflow.id;

        return (
          <Card
            key={workflow.id}
            className="p-6 flex flex-col justify-between border-gray-200 shadow-sm hover:shadow-md transition-all rounded-xl relative overflow-hidden"
          >
            {isBusy && (
              <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center backdrop-blur-[1px]" />
            )}
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg inline-block text-gray-600">
                  <GitBranch className="w-5 h-5" />
                </div>
                <Badge
                  variant={isActive ? "success" : "secondary"}
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
              <div className="flex-1">
                {renderEditLink(
                  workflow,
                  <Button variant="outline" className="w-full font-semibold">
                    Edit Flow
                  </Button>,
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-gray-100"
                onClick={() => onToggleStatus(workflow)}
                disabled={isBusy}
                title={isActive ? "Pause" : "Go live"}
              >
                {isActive ? (
                  <Pause size={18} className="text-gray-600" />
                ) : (
                  <Play size={18} className="text-gray-600" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:bg-red-50 hover:text-red-600"
                onClick={() => onDelete(workflow)}
                disabled={isBusy}
                title="Delete"
              >
                <Trash2 size={18} />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
