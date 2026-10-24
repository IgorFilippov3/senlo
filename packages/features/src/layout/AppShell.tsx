// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useEffect, useState } from "react";
import { useProjects } from "../data/workspaces";
import { useRememberedWorkspace } from "../workspaces/rememberedWorkspace";
import { useSenloNavigation } from "./navigation-context";
import type { NavItem } from "./navigation";
import { Sidebar } from "./Sidebar";

export interface AppSidebarProps {
  brandName: string;
  brandIcon: React.ReactNode;
  /** Signs the user out (a host action); the remembered workspace is forgotten first. */
  onSignOut?: () => void | Promise<void>;
  /** Above the workspace switcher (managed: an organization switcher). */
  header?: React.ReactNode;
  /** Above "Sign out" (managed: plan and billing). */
  footer?: React.ReactNode;
  /** Override the default items, e.g. to add managed-only pages. */
  workspaceItems?: (workspaceId: number) => NavItem[];
  globalItems?: NavItem[];
  mainItems?: NavItem[];
}

/** The sidebar over the host's navigation and the user's workspaces. */
export function AppSidebar({ onSignOut, ...props }: AppSidebarProps) {
  const { pathname, paths, push, renderLink } = useSenloNavigation();
  const { data: projects = [] } = useProjects();
  const { setWorkspaceId } = useRememberedWorkspace();

  return (
    <Sidebar
      {...props}
      pathname={pathname}
      paths={paths}
      workspaces={projects}
      renderLink={renderLink}
      onShowAllWorkspaces={() => {
        setWorkspaceId(null);
        push(paths.workspaces());
      }}
      onSignOut={
        onSignOut &&
        (async () => {
          // Remembered per browser: left behind, it would point the next
          // person to sign in here at a workspace that is not theirs.
          setWorkspaceId(null);
          await onSignOut();
        })
      }
    />
  );
}

/**
 * The signed-in page frame: the sidebar on the left, the page beside it, no
 * sidebar on the pages that hide it (`paths.hidesSidebar`). The sidebar
 * appears after mount: it depends on the remembered workspace and the
 * workspaces list, which the server does not have, so rendering it there
 * would not match the first client render.
 */
export function AppShell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { pathname, paths } = useSenloNavigation();

  useEffect(() => {
    setMounted(true);
  }, []);

  const showSidebar = mounted && !paths.hidesSidebar(pathname);

  return (
    <div className="flex min-h-screen">
      {showSidebar && sidebar}
      <div className={`flex-1 ${showSidebar ? "pl-64" : ""}`}>{children}</div>
    </div>
  );
}
