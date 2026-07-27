"use client";

import React, { useEffect, useState, createContext, useContext } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProjects } from "apps/web/queries/projects";
import { useWorkspaceStorage } from "apps/web/hooks/use-workspace-storage";
import { Loader2 } from "lucide-react";

interface WorkspaceContextType {
  workspace: any | null;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspace: null,
  isLoading: true,
});

export const useCurrentWorkspace = () => useContext(WorkspaceContext);

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const params = useParams();
  const router = useRouter();
  const { setWorkspaceId } = useWorkspaceStorage();

  const id = params.id ? Number(params.id) : null;

  // Используем общий список воркспейсов вместо отдельного запроса по ID
  const { data: projects, isLoading } = useProjects();
  const workspace = projects?.find((p) => p.id === id) || null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (id) {
      setWorkspaceId(id);
    }
  }, [id, setWorkspaceId]);

  useEffect(() => {
    // Если загрузка завершена, а воркспейс не найден в списке — значит доступа нет или ID неверный
    if (mounted && !isLoading && !workspace && id) {
      console.error("Workspace not found in list", id);
      router.push("/workspaces");
    }
  }, [workspace, isLoading, id, router, mounted]);

  if (!mounted || isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-zinc-400" size={32} />
      </div>
    );
  }

  return (
    <WorkspaceContext.Provider value={{ workspace, isLoading }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
