// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import {
  Sidebar as SharedSidebar,
  useProjects,
  useRememberedWorkspace,
  useSenloNavigation,
} from "@senlo/features";
import { logoutAction } from "@/app/(auth)/actions";

export function Sidebar() {
  const { pathname, paths, push, renderLink } = useSenloNavigation();
  const { data: projects = [] } = useProjects();
  const { setWorkspaceId } = useRememberedWorkspace();

  return (
    <SharedSidebar
      brandName="Senlo Email"
      brandIcon="S"
      pathname={pathname}
      paths={paths}
      workspaces={projects}
      onShowAllWorkspaces={() => {
        setWorkspaceId(null);
        push(paths.workspaces());
      }}
      onSignOut={async () => {
        // Remembered per browser: left behind, it would point the next
        // person to sign in here at a workspace that is not theirs.
        setWorkspaceId(null);
        await logoutAction();
      }}
      renderLink={renderLink}
    />
  );
}
