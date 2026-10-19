"use client";

import React from "react";
import type { Project } from "@senlo/core";
import { Badge, Button, Card } from "@senlo/ui";
import { ArrowRight, Plus } from "lucide-react";
import { LoadingScreen } from "../shared/Loading";

export interface WorkspacePickerProps {
  /** Product name in the greeting ("Welcome back to …"). */
  brandName: string;
  brandIcon: React.ReactNode;
  workspaces: Project[];
  isLoading: boolean;
  error?: string | null;
  onSelect: (workspace: Project) => void;
  onCreate: () => void;
  onRetry: () => void;
  /** Below the grid: links, copyright. */
  footer?: React.ReactNode;
}

export function WorkspacePicker({
  brandName,
  brandIcon,
  workspaces,
  isLoading,
  error,
  onSelect,
  onCreate,
  onRetry,
  footer,
}: WorkspacePickerProps) {
  if (isLoading) {
    return <LoadingScreen label="Loading your workspaces..." />;
  }

  return (
    <div className="min-h-screen bg-zinc-50/50 py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center mb-12 text-center">
          <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-6 shadow-xl">
            {brandIcon}
          </div>
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight mb-2">
            Welcome back to {brandName}
          </h1>
          <p className="text-zinc-500 max-w-md">
            Select a workspace to continue or create a new one for your next project.
          </p>
        </div>

        {error ? (
          <Card className="p-8 border-rose-100 bg-rose-50/50 text-center">
            <p className="text-rose-600 font-medium mb-4">{error}</p>
            <Button variant="outline" onClick={onRetry}>
              Try again
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {workspaces.map((workspace) => (
              <Card
                key={workspace.id}
                className="group p-6 border-zinc-200 hover:border-blue-500 hover:shadow-xl transition-all cursor-pointer bg-white"
                onClick={() => onSelect(workspace)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 font-bold text-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    {workspace.name[0]?.toUpperCase()}
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight size={20} className="text-blue-600" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-zinc-900 mb-1 group-hover:text-blue-600 transition-colors">
                  {workspace.name}
                </h3>
                <p className="text-zinc-500 text-sm line-clamp-2 mb-4">
                  {workspace.description || "No description provided."}
                </p>
                <div className="flex items-center gap-2 pt-4 border-t border-zinc-50">
                  <Badge variant="secondary" className="bg-zinc-100 text-zinc-500 border-none text-[10px]">
                    Workspace ID: {workspace.id}
                  </Badge>
                </div>
              </Card>
            ))}

            <Card
              className="p-6 border-dashed border-zinc-300 hover:border-blue-500 hover:bg-blue-50/30 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px] text-center"
              onClick={onCreate}
            >
              <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400 mb-4">
                <Plus size={24} />
              </div>
              <h3 className="font-bold text-zinc-900">Create Workspace</h3>
              <p className="text-zinc-500 text-sm mt-1">Start a fresh project</p>
            </Card>
          </div>
        )}

        {footer && (
          <div className="mt-16 pt-8 border-t border-zinc-200 text-sm text-zinc-400">{footer}</div>
        )}
      </div>
    </div>
  );
}
