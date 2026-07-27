"use client";

import { Button, Dialog } from "@senlo/ui";
import { Project } from "@senlo/core";
import { logger } from "apps/web/lib/logger";
import { useDeleteProject } from "apps/web/queries/projects";

interface DeleteProjectDialogProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
}

export default function DeleteWorkspaceDialog({
  project: workspace,
  isOpen,
  onClose,
}: DeleteProjectDialogProps) {
  const { mutate: deleteProject, isPending: isDeleting } = useDeleteProject();

  const confirmDelete = async () => {
    deleteProject(workspace.id, {
      onSuccess: () => {
        onClose();
      },
      onError: (error) => {
        logger.error("Failed to delete workspace from dialog", {
          projectId: workspace.id,
          error: error instanceof Error ? error.message : String(error),
        });
        alert("Failed to delete workspace. Please try again.");
      },
    });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      disableAnimation={true}
      title="Delete Workspace"
      description={`Are you sure you want to delete "${workspace.name}"? All templates inside this workspace will also be deleted. This action cannot be undone.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirmDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Workspace"}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-zinc-500">
        This will permanently remove the workspace and all its associated data.
      </p>
    </Dialog>
  );
}
