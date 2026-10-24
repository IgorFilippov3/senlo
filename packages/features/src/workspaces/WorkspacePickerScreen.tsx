// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { useProjects } from "../data/workspaces";
import { useSenloDialogs } from "../dialogs/registry";
import { useSenloNavigation } from "../layout/navigation-context";
import { WorkspacePicker } from "./WorkspacePicker";

export interface WorkspacePickerScreenProps {
  brandName?: string;
  brandIcon?: React.ReactNode;
  /** Below the grid: links, copyright. */
  footer?: React.ReactNode;
}

/** The workspace picker over the user's workspaces; opening one goes to its dashboard. */
export function WorkspacePickerScreen({ brandName = "Senlo", brandIcon = "S", footer }: WorkspacePickerScreenProps) {
  const { paths, push } = useSenloNavigation();
  const { data: workspaces = [], isLoading, error, refetch } = useProjects();
  const { open: openDialog } = useSenloDialogs();

  return (
    <WorkspacePicker
      brandName={brandName}
      brandIcon={brandIcon}
      workspaces={workspaces}
      isLoading={isLoading}
      error={error?.message}
      // The workspace route remembers it once the page opens.
      onSelect={(workspace) => push(paths.dashboard(workspace.id))}
      onCreate={() => openDialog("CREATE_WORKSPACE", {})}
      onRetry={() => refetch()}
      footer={footer}
    />
  );
}
