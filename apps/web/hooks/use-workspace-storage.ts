import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "senlo_last_workspace_id";

export function useWorkspaceStorage() {
  const [lastWorkspaceId, setLastWorkspaceId] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setLastWorkspaceId(Number(stored));
    }
    setIsLoaded(true);
  }, []);

  const setWorkspaceId = useCallback((id: number | null) => {
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, String(id));
    }
    setLastWorkspaceId(id);
  }, []);

  return { lastWorkspaceId, setWorkspaceId, isLoaded };
}
