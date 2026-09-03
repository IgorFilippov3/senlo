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
    // Remember it only once the list confirms this account owns it. Writing the
    // raw URL id would persist any workspace someone typed or followed a stale
    // link to, and /home would then keep sending them back to it.
    if (id && workspace) {
      setWorkspaceId(id);
    }
  }, [id, workspace, setWorkspaceId]);

  useEffect(() => {
    // Загрузка завершена, а воркспейс не найден в списке — нет доступа или ID
    // неверный. Забываем его, иначе /home снова приведёт сюда же.
    if (mounted && !isLoading && !workspace && id) {
      setWorkspaceId(null);
      router.push("/workspaces");
    }
  }, [workspace, isLoading, id, router, mounted, setWorkspaceId]);

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
