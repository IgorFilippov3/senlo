"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { WorkspaceScope, useRememberedWorkspace, useProjects } from "@senlo/features";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const { setWorkspaceId } = useRememberedWorkspace();
  const id = Number(params.id);

  const { data: projects, isPending } = useProjects();
  const workspace = projects?.find((p) => p.id === id) ?? null;

  useEffect(() => {
    // Remember it only once the list confirms this account owns it, or a typed
    // or stale URL would keep sending /home back here.
    if (workspace) setWorkspaceId(workspace.id);
  }, [workspace, setWorkspaceId]);

  useEffect(() => {
    // Not in the list: no access, a wrong id, or just deleted. Forget it and
    // go to the picker.
    if (!isPending && !workspace) {
      setWorkspaceId(null);
      router.push("/workspaces");
    }
  }, [isPending, workspace, router, setWorkspaceId]);

  return <WorkspaceScope workspace={workspace}>{children}</WorkspaceScope>;
}
