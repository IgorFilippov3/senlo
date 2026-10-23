// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { createContext, useContext } from "react";
import type { EmailDesignDocument } from "@senlo/core";

/** Places the editor can ask its host to take the user to. */
export type EditorNavigationTarget =
  /** Leave the editor (the host knows where the user came from). */
  | "back"
  /** Where an AI provider is connected to the workspace. */
  | "ai-settings";

export interface AiGenerateRequest {
  prompt: string;
  /** The current document when the user asks to change it, not build anew. */
  currentDesign?: EmailDesignDocument;
}

/**
 * Sample values for merge tags the preview has no recipient for. Each one
 * left out keeps the editor's default ("Sample Workspace" and so on).
 */
export interface EditorPreviewData {
  /** `{{workspace.name}}`; the self-hosted app passes the real project name. */
  workspaceName?: string;
  /** `{{trigger.name}}`. */
  triggerName?: string;
  /** `{{unsubscribe_url}}`: where the preview's unsubscribe link points. */
  unsubscribeUrl?: string;
}

/**
 * What the editor needs from the application around it. The editor knows no
 * routes, endpoints or origins: each host (self-hosted app, managed app)
 * supplies its own. Every member is optional; a missing one hides the feature.
 */
export interface EditorHost {
  /** Absolute origin for relative URLs (uploaded images) in rendered HTML. */
  baseUrl?: string;
  /** Whether the workspace has an AI provider connected. */
  hasAiProvider?: boolean;
  /** Called after the editor has confirmed leaving with unsaved changes. */
  onNavigate?: (target: EditorNavigationTarget) => void;
  /** Stores an image and resolves to its public URL. Throws with a message. */
  uploadImage?: (file: File) => Promise<string>;
  /** Resolves to the generated document. Throws with a message. */
  generateWithAi?: (request: AiGenerateRequest) => Promise<EmailDesignDocument>;
  /** Sample merge tag values for the preview; see `EditorPreviewData`. */
  previewData?: EditorPreviewData;
}

const EditorHostContext = createContext<EditorHost>({});

export const EditorHostProvider = EditorHostContext.Provider;

export const useEditorHost = (): EditorHost => useContext(EditorHostContext);
