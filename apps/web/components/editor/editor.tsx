"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  EditorLayout,
  type AiGenerateRequest,
  type EditorLayoutProps,
  type EditorNavigationTarget,
} from "@senlo/editor";
import type { EmailDesignDocument } from "@senlo/core";

type HostCallbacks = "onNavigate" | "uploadImage" | "generateWithAi";

export interface EditorProps extends Omit<EditorLayoutProps, HostCallbacks> {
  projectId: number;
  /** Set when the editor was opened from a trigger, so Back returns there. */
  campaignId: number | null;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function errorMessage(data: Record<string, unknown>, fallback: string): string {
  return typeof data.error === "string" && data.error ? data.error : fallback;
}

/** The self-hosted app's routes and endpoints for the editor. */
export function Editor({ projectId, campaignId, ...props }: EditorProps) {
  const router = useRouter();

  const onNavigate = useCallback(
    (target: EditorNavigationTarget) => {
      if (target === "ai-settings") {
        router.push(`/workspace/${projectId}/settings/general`);
      } else if (campaignId) {
        router.push(`/workspace/${projectId}/triggers/${campaignId}`);
      } else {
        router.push(`/workspace/${projectId}/templates`);
      }
    },
    [router, projectId, campaignId],
  );

  const uploadImage = useCallback(async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/upload", { method: "POST", body });
    const data = await readJson(response);
    if (!response.ok || typeof data.url !== "string") {
      throw new Error(errorMessage(data, "Failed to upload image"));
    }
    return data.url;
  }, []);

  const generateWithAi = useCallback(
    async ({ prompt, currentDesign }: AiGenerateRequest) => {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, projectId, currentDesign }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        throw new Error(errorMessage(data, "Failed to generate template"));
      }
      if (!data.design) {
        throw new Error("Invalid response from AI");
      }
      return data.design as EmailDesignDocument;
    },
    [projectId],
  );

  return (
    <EditorLayout
      {...props}
      onNavigate={onNavigate}
      uploadImage={uploadImage}
      generateWithAi={generateWithAi}
    />
  );
}
