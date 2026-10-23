// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useMemo } from "react";
import { useEditorHost, type EditorPreviewData } from "../host";
import { useEditorStore } from "../state/editor.store";

/** What the preview shows for the merge tags no recipient fills in. */
export const DEFAULT_PREVIEW_DATA: Required<EditorPreviewData> = {
  workspaceName: "Sample Workspace",
  triggerName: "Sample Trigger",
  unsubscribeUrl: "https://senlo.io/unsubscribe/sample-token",
};

/** Merge tag values for the canvas preview and the preview window. */
export function buildPreviewData(
  previewContact: Record<string, any> | null,
  host: EditorPreviewData = {},
) {
  const sample = { ...DEFAULT_PREVIEW_DATA, ...stripUndefined(host) };
  return {
    contact: previewContact || {},
    // The mock data doubles as a trigger's custom variables.
    custom: previewContact || {},
    workspace: { name: sample.workspaceName },
    trigger: { name: sample.triggerName },
    unsubscribeUrl: sample.unsubscribeUrl,
  };
}

/** `buildPreviewData` for the current mock contact and the host's sample values. */
export function usePreviewData() {
  const previewContact = useEditorStore((s) => s.previewContact);
  const { previewData } = useEditorHost();
  return useMemo(() => buildPreviewData(previewContact, previewData), [previewContact, previewData]);
}

function stripUndefined(values: EditorPreviewData): EditorPreviewData {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined));
}
