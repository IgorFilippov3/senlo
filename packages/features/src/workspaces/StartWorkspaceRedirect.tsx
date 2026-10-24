// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useEffect } from "react";
import { useProjects } from "../data/workspaces";
import { useSenloNavigation } from "../layout/navigation-context";
import { LoadingScreen } from "../shared/Loading";
import { pickStartWorkspace, useRememberedWorkspace } from "./rememberedWorkspace";

/**
 * Where a signed-in user lands (`paths.home()`): the remembered workspace if
 * this account still has it, else the first one, else the picker.
 */
export function StartWorkspaceRedirect() {
  const { paths, replace } = useSenloNavigation();
  const { lastWorkspaceId, isLoaded, setWorkspaceId } = useRememberedWorkspace();
  const { data: projects, isLoading } = useProjects();

  useEffect(() => {
    if (!isLoaded || isLoading || !projects) return;

    // The remembered workspace lives in localStorage, which belongs to the
    // browser rather than to the account. It survives signing out, signing in
    // as someone else, and deleting the workspace it points at, so following
    // it blindly drops a fresh account into a workspace it cannot see and out
    // to an error. Resolve it against what this account actually owns.
    const target = pickStartWorkspace(projects, lastWorkspaceId);

    if (!target) {
      setWorkspaceId(null);
      replace(paths.workspaces());
      return;
    }

    if (target.id !== lastWorkspaceId) {
      setWorkspaceId(target.id);
    }

    replace(paths.dashboard(target.id));
  }, [projects, isLoading, lastWorkspaceId, isLoaded, replace, paths, setWorkspaceId]);

  return <LoadingScreen label="Preparing your workspace..." />;
}
