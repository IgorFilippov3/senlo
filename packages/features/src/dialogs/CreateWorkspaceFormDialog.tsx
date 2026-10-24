// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { useCreateProject } from "../data";
import { CreateWorkspaceDialog } from "../workspaces";
import type { DialogControlProps } from "../shared/dialogs";

export default function CreateWorkspaceFormDialog({ isOpen, onClose }: DialogControlProps) {
  const create = useCreateProject();

  return (
    <CreateWorkspaceDialog
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={(values) => create.mutate(values, { onSuccess: onClose })}
      isLoading={create.isPending}
      error={create.error?.message}
    />
  );
}
