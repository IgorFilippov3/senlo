"use client";

import { useRouter } from "next/navigation";
import { useProjects } from "apps/web/hooks/use-projects";
import { useWorkspaceStorage } from "apps/web/hooks/use-workspace-storage";
import { Card, Button, Badge } from "@senlo/ui";
import { Loader2, Plus, ArrowRight } from "lucide-react";
import { useDialogStore } from "apps/web/providers/dialogs/store";

export default function WorkspacesPage() {
  const router = useRouter();
  const { projects, loading, error } = useProjects();
  const { setWorkspaceId } = useWorkspaceStorage();
  const openDialog = useDialogStore((state) => state.open);

  const handleSelectWorkspace = (id: number) => {
    setWorkspaceId(id);
    router.push(`/workspace/${id}/dashboard`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
          <p className="text-zinc-500 font-medium">
            Loading your workspaces...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/50 py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center mb-12 text-center">
          <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-6 shadow-xl">
            S
          </div>
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight mb-2">
            Welcome back to Senlo
          </h1>
          <p className="text-zinc-500 max-w-md">
            Select a workspace to continue or create a new one for your next
            project.
          </p>
        </div>

        {error ? (
          <Card className="p-8 border-rose-100 bg-rose-50/50 text-center">
            <p className="text-rose-600 font-medium mb-4">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map((workspace) => (
              <Card
                key={workspace.id}
                className="group p-6 border-zinc-200 hover:border-blue-500 hover:shadow-xl transition-all cursor-pointer bg-white"
                onClick={() => handleSelectWorkspace(workspace.id)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 font-bold text-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    {workspace.name[0].toUpperCase()}
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight size={20} className="text-blue-600" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-zinc-900 mb-1 group-hover:text-blue-600 transition-colors">
                  {workspace.name}
                </h3>
                <p className="text-zinc-500 text-sm line-clamp-2 mb-4">
                  {workspace.description || "No description provided."}
                </p>
                <div className="flex items-center gap-2 pt-4 border-t border-zinc-50">
                  <Badge
                    variant="secondary"
                    className="bg-zinc-100 text-zinc-500 border-none text-[10px]"
                  >
                    Workspace ID: {workspace.id}
                  </Badge>
                </div>
              </Card>
            ))}

            <Card
              className="p-6 border-dashed border-zinc-300 hover:border-blue-500 hover:bg-blue-50/30 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px] text-center"
              onClick={() => openDialog("CREATE_WORKSPACE", {})}
            >
              <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400 mb-4 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                <Plus size={24} />
              </div>
              <h3 className="font-bold text-zinc-900">Create Workspace</h3>
              <p className="text-zinc-500 text-sm mt-1">
                Start a fresh project
              </p>
            </Card>
          </div>
        )}

        <div className="mt-16 pt-8 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-400">
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-zinc-600 transition-colors">
              Documentation
            </a>
            <a href="#" className="hover:text-zinc-600 transition-colors">
              Support
            </a>
            <a href="#" className="hover:text-zinc-600 transition-colors">
              Settings
            </a>
          </div>
          <p>&copy; 2026 Senlo Email Platform</p>
        </div>
      </div>
    </div>
  );
}
