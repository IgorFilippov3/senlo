"use client";

import { useCallback, useEffect, useState } from "react";
import type { Project } from "@senlo/core";

const STORAGE_KEY = "senlo_last_workspace_id";

function read(): number | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) : null;
  } catch {
    return null;
  }
}

function write(id: number | null) {
  try {
    if (id === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // Storage blocked (private mode, disabled site data): nothing to remember.
  }
}

/**
 * The last workspace opened in this browser. It belongs to the browser, not
 * the account, so callers resolve it against the account's own workspaces
 * (`pickStartWorkspace`) and forget it on sign-out.
 */
export function useRememberedWorkspace() {
  const [lastWorkspaceId, setLastWorkspaceId] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setLastWorkspaceId(read());
    setIsLoaded(true);
  }, []);

  const setWorkspaceId = useCallback((id: number | null) => {
    write(id);
    setLastWorkspaceId(id);
  }, []);

  return { lastWorkspaceId, setWorkspaceId, isLoaded };
}

/**
 * Where to land after sign-in: the remembered workspace if this account still
 * owns it, else its first one, else none (the picker).
 */
export function pickStartWorkspace(
  workspaces: Project[],
  rememberedId: number | null,
): Project | undefined {
  const remembered =
    rememberedId === null ? undefined : workspaces.find((w) => w.id === rememberedId);
  return remembered ?? workspaces[0];
}
