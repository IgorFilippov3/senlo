import { PageHeader } from "@senlo/ui";
import { WorkspaceSettings } from "apps/web/components/workspaces/workspace-settings";

export default function GeneralSettingsPage() {
  return (
    <main className="max-w-7xl mx-auto py-10 px-8">
      <PageHeader
        title="General Settings"
        description="Manage your workspace details and configuration."
      />
      <div className="mt-8">
        <WorkspaceSettings />
      </div>
    </main>
  );
}
