"use client";

import { PageHeader, Button, Card } from "@senlo/ui";
import { LogOut, User, Shield, Bell } from "lucide-react";
import { logoutAction } from "../../../../(auth)/actions";
import { useWorkspaceStorage } from "apps/web/hooks/use-workspace-storage";

export default function SettingsPage() {
  const { setWorkspaceId } = useWorkspaceStorage();

  // The remembered workspace is stored per browser. Left behind, it points the
  // next person to sign in on this machine at a workspace that is not theirs.
  async function handleSignOut() {
    setWorkspaceId(null);
    await logoutAction();
  }

  return (
    <main className="max-w-7xl mx-auto py-10 px-8">
      <PageHeader
        title="Settings"
        description="Manage your account preferences and security settings."
      />

      <div className="space-y-6 mt-8">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500">
                <User size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">Account</h3>
                <p className="text-sm text-zinc-500">
                  Manage your profile and personal information.
                </p>
              </div>
            </div>
            <Button variant="outline" disabled>
              Edit Profile
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">
                  Security
                </h3>
                <p className="text-sm text-zinc-500">
                  Update your password and security preferences.
                </p>
              </div>
            </div>
            <Button variant="outline" disabled>
              Update Security
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500">
                <Bell size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">
                  Notifications
                </h3>
                <p className="text-sm text-zinc-500">
                  Configure how you receive updates and alerts.
                </p>
              </div>
            </div>
            <Button variant="outline" disabled>
              Manage Notifications
            </Button>
          </div>
        </Card>

        <div className="pt-6 border-t border-zinc-100">
          <form action={handleSignOut}>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              type="submit"
            >
              <LogOut size={18} className="mr-2" />
              Sign Out
            </Button>
          </form>
          <p className="text-xs text-zinc-400 mt-4">
            You will be redirected to the login page after signing out.
          </p>
        </div>
      </div>
    </main>
  );
}
