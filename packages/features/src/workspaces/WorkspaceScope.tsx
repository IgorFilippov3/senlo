"use client";

import React, { createContext, useContext } from "react";
import type { Project } from "@senlo/core";
import { Loader2 } from "lucide-react";

const WorkspaceContext = createContext<Project | null>(null);

/**
 * Renders its children only once the workspace is known, and gives them the
 * workspace through `useCurrentWorkspace`. Until then (loading, or about to be
 * redirected away) it shows a spinner.
 */
export function WorkspaceScope({
  workspace,
  children,
}: {
  workspace: Project | null;
  children: React.ReactNode;
}) {
  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-zinc-400" size={32} />
      </div>
    );
  }
  return <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>;
}

/** The workspace of the surrounding `WorkspaceScope`. */
export function useCurrentWorkspace(): Project {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("useCurrentWorkspace must be used inside a WorkspaceScope");
  return workspace;
}
