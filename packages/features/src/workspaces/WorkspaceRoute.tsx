// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useEffect } from "react";
import { useProjects } from "../data/workspaces";
import { useSenloNavigation } from "../layout/navigation-context";
import { useRememberedWorkspace } from "./rememberedWorkspace";
import { WorkspaceScope } from "./WorkspaceScope";

/**
 * Everything under one workspace's URLs (a host's workspace layout): checks
 * the workspace is in the user's list, remembers it, and gives the pages
 * `useCurrentWorkspace()`. A workspace not in the list (no access, a wrong
 * id, just deleted) is forgotten and the user goes to the picker.
 */
export function WorkspaceRoute({ workspaceId, children }: { workspaceId: number; children: React.ReactNode }) {
  const { paths, push } = useSenloNavigation();
  const { setWorkspaceId } = useRememberedWorkspace();
  const { data: projects, isPending } = useProjects();
  const workspace = projects?.find((p) => p.id === workspaceId) ?? null;

  useEffect(() => {
    // Remember it only once the list confirms this account owns it, or a
    // typed or stale URL would keep sending home back here.
    if (workspace) setWorkspaceId(workspace.id);
  }, [workspace, setWorkspaceId]);

  useEffect(() => {
    if (!isPending && !workspace) {
      setWorkspaceId(null);
      push(paths.workspaces());
    }
  }, [isPending, workspace, push, paths, setWorkspaceId]);

  return <WorkspaceScope workspace={workspace}>{children}</WorkspaceScope>;
}
