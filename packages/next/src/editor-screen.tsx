// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useCallback, useMemo } from "react";
import type { EmailDesignDocument } from "@senlo/core";
import {
  EditorLayout,
  type AiGenerateRequest,
  type EditorLayoutProps,
  type EditorNavigationTarget,
} from "@senlo/editor";
import { useSenloNavigation, type ActionTransport } from "@senlo/features";
import { createEditorActions } from "./editor-actions";

type HostCallbacks =
  | "onNavigate"
  | "uploadImage"
  | "generateWithAi"
  | "onSave"
  | "onSendTest"
  | "onListSavedRows"
  | "onSaveRow"
  | "onDeleteSavedRow";

/** Where the editor's two non-action calls go; self-hosted's routes by default. */
export interface EditorEndpoints {
  upload: string;
  aiGenerate: string;
}

const DEFAULT_ENDPOINTS: EditorEndpoints = { upload: "/api/upload", aiGenerate: "/api/ai/generate" };

export interface EditorScreenProps extends Omit<EditorLayoutProps, HostCallbacks> {
  projectId: number;
  /** Set when the editor was opened from a trigger, so Back returns there. */
  campaignId: number | null;
  /** The host's action transport (its `senloAction` Server Action): save, test send, saved rows. */
  call: ActionTransport;
  endpoints?: Partial<EditorEndpoints>;
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

/**
 * The editor wired to a host: its server calls through the action
 * transport, image upload and AI generation through the host's routes
 * (`createSenloRoutes` serves both), Back and "AI settings" through the
 * navigation port. Needs a navigation provider above it.
 */
export function EditorScreen({ projectId, campaignId, call, endpoints, ...props }: EditorScreenProps) {
  const { paths, push } = useSenloNavigation();
  const serverActions = useMemo(() => createEditorActions(call), [call]);
  const upload = endpoints?.upload ?? DEFAULT_ENDPOINTS.upload;
  const aiGenerate = endpoints?.aiGenerate ?? DEFAULT_ENDPOINTS.aiGenerate;

  const onNavigate = useCallback(
    (target: EditorNavigationTarget) => {
      if (target === "ai-settings") push(paths.settings(projectId));
      else if (campaignId) push(paths.trigger(projectId, campaignId));
      else push(paths.templates(projectId));
    },
    [push, paths, projectId, campaignId],
  );

  const uploadImage = useCallback(
    async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(upload, { method: "POST", body });
      const data = await readJson(response);
      if (!response.ok || typeof data.url !== "string") {
        throw new Error(errorMessage(data, "Failed to upload image"));
      }
      return data.url;
    },
    [upload],
  );

  const generateWithAi = useCallback(
    async ({ prompt, currentDesign }: AiGenerateRequest) => {
      const response = await fetch(aiGenerate, {
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
    [aiGenerate, projectId],
  );

  return (
    <EditorLayout
      {...props}
      {...serverActions}
      onNavigate={onNavigate}
      uploadImage={uploadImage}
      generateWithAi={generateWithAi}
    />
  );
}
