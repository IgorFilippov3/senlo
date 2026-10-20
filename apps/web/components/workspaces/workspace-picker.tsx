"use client";

import { useRouter } from "next/navigation";
import {
  WorkspacePicker as SharedWorkspacePicker,
  workspaceHomePath,
  useProjects,
} from "@senlo/features";
import { useDialogs } from "@/providers/dialogs/store";

export function WorkspacePicker() {
  const router = useRouter();
  const { data: workspaces = [], isLoading, error, refetch } = useProjects();
  const { open: openDialog } = useDialogs();

  return (
    <SharedWorkspacePicker
      brandName="Senlo"
      brandIcon="S"
      workspaces={workspaces}
      isLoading={isLoading}
      error={error?.message}
      // The workspace layout remembers it once the page opens.
      onSelect={(workspace) => router.push(workspaceHomePath(workspace.id))}
      onCreate={() => openDialog("CREATE_WORKSPACE", {})}
      onRetry={() => refetch()}
      footer={<p className="text-right">&copy; 2026 Senlo Email Platform</p>}
    />
  );
}
