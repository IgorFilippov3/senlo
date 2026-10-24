// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { useDeleteProject } from "../data";
import { useSenloNavigation } from "../layout/navigation-context";
import { DeleteWorkspaceDialog } from "../workspaces";
import type { DialogControlProps } from "../shared/dialogs";
import type { SenloDialogProps } from "./registry";

/** Lives in the dialog host, so it stays mounted while the deleted workspace's pages go away under it. */
export default function DeleteWorkspaceConfirmDialog({
  project,
  isOpen,
  onClose,
}: SenloDialogProps["DELETE_WORKSPACE"] & DialogControlProps) {
  const { paths, push } = useSenloNavigation();
  const remove = useDeleteProject();

  return (
    <DeleteWorkspaceDialog
      name={project.name}
      isOpen={isOpen}
      onClose={onClose}
      isDeleting={remove.isPending}
      error={remove.error?.message}
      onConfirm={() =>
        remove.mutate(project.id, {
          onSuccess: () => {
            onClose();
            push(paths.workspaces());
          },
        })
      }
    />
  );
}
