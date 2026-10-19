"use client";

import { usePathname, useRouter } from "next/navigation";
import { Sidebar as SharedSidebar, useRememberedWorkspace } from "@senlo/features";
import { logoutAction } from "apps/web/app/(auth)/actions";
import { useProjects } from "apps/web/queries/projects";
import { renderLink } from "apps/web/components/link";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: projects = [] } = useProjects();
  const { setWorkspaceId } = useRememberedWorkspace();

  return (
    <SharedSidebar
      brandName="Senlo Email"
      brandIcon="S"
      pathname={pathname}
      workspaces={projects}
      onShowAllWorkspaces={() => {
        setWorkspaceId(null);
        router.push("/workspaces");
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
