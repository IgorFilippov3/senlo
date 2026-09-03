"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProjects } from "apps/web/queries/projects";
import { useWorkspaceStorage } from "apps/web/hooks/use-workspace-storage";
import { Loader2 } from "lucide-react";

export default function AppHomePage() {
  const router = useRouter();
  const { lastWorkspaceId, isLoaded, setWorkspaceId } = useWorkspaceStorage();
  const { data: projects, isLoading } = useProjects();

  useEffect(() => {
    if (!isLoaded || isLoading || !projects) return;

    // The remembered workspace lives in localStorage, which belongs to the
    // browser rather than to the account. It survives signing out, signing in
    // as someone else, and deleting the workspace it points at — so following
    // it blindly drops a fresh account into a workspace it cannot see and out
    // to an error. Resolve it against what this account actually owns.
    const remembered =
      lastWorkspaceId === null
        ? undefined
        : projects.find((project) => project.id === lastWorkspaceId);
    const target = remembered ?? projects[0];

    if (!target) {
      setWorkspaceId(null);
      router.replace("/workspaces");
      return;
    }

    if (target.id !== lastWorkspaceId) {
      setWorkspaceId(target.id);
    }

    router.replace(`/workspace/${target.id}/dashboard`);
  }, [projects, isLoading, lastWorkspaceId, isLoaded, router, setWorkspaceId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
        <p className="text-zinc-500 font-medium">Preparing your workspace...</p>
      </div>
    </div>
  );
}
