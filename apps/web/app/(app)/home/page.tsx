"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStorage } from "apps/web/hooks/use-workspace-storage";
import { Loader2 } from "lucide-react";

export default function AppHomePage() {
  const router = useRouter();
  const { lastWorkspaceId, isLoaded } = useWorkspaceStorage();

  useEffect(() => {
    if (!isLoaded) return;

    if (lastWorkspaceId) {
      router.replace(`/workspace/${lastWorkspaceId}/dashboard`);
    } else {
      router.replace("/workspaces");
    }
  }, [lastWorkspaceId, isLoaded, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
        <p className="text-zinc-500 font-medium">Preparing your workspace...</p>
      </div>
    </div>
  );
}
