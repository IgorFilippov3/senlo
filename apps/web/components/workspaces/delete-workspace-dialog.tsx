"use client";

import { useRouter } from "next/navigation";
import type { Project } from "@senlo/core";
import { DeleteWorkspaceDialog as SharedDeleteWorkspaceDialog } from "@senlo/features";
import { useDeleteProject } from "apps/web/queries/projects";

interface DeleteWorkspaceDialogProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Registered as DELETE_WORKSPACE. Lives in the app-level dialog host, not in
 * the workspace pages, so it stays mounted while the deleted workspace's
 * pages go away under it.
 */
export default function DeleteWorkspaceDialog({ project, isOpen, onClose }: DeleteWorkspaceDialogProps) {
  const router = useRouter();
  const remove = useDeleteProject();

  return (
    <SharedDeleteWorkspaceDialog
      name={project.name}
      isOpen={isOpen}
      onClose={onClose}
      isDeleting={remove.isPending}
      error={remove.error?.message}
      onConfirm={() =>
        remove.mutate(project.id, {
          onSuccess: () => {
            onClose();
            router.push("/workspaces");
          },
        })
      }
    />
  );
}
