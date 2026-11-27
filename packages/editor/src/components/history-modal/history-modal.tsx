// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useState } from "react";
import type { EmailTemplateVersionSummary, TemplateVersionAuthor, TemplateVersionSource } from "@senlo/core";
import { Button, Dialog } from "@senlo/ui";
import { useEditorStore } from "../../state/editor.store";
import { useEditorHost } from "../../host";
import styles from "./history-modal.module.css";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SOURCE_LABELS: Record<TemplateVersionSource, string> = {
  editor: "Editor",
  api: "API",
  mcp: "AI agent (MCP)",
  baseline: "Before history",
};

function authorLabel(author: TemplateVersionAuthor): string | null {
  if (!author) return null;
  if (author.kind === "user") return author.name || author.email;
  return `${author.name} (${author.prefix}…)`;
}

/**
 * The template's saved versions. Restore loads one into the editor as
 * unsaved changes; nothing is stored until Save, which then adds it as the
 * newest version. History itself is never rewritten.
 */
export const HistoryModal = ({ isOpen, onClose }: HistoryModalProps) => {
  const { listVersions, getVersion } = useEditorHost();
  const templateId = useEditorStore((s) => s.templateId);
  const isDirty = useEditorStore((s) => s.isDirty);
  const restoreVersion = useEditorStore((s) => s.restoreVersion);

  const [versions, setVersions] = useState<EmailTemplateVersionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  /** The version waiting for "Replace unsaved changes?" to be confirmed. */
  const [confirmId, setConfirmId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !templateId || !listVersions) return;
    let cancelled = false;
    setVersions(null);
    setError(null);
    setConfirmId(null);
    listVersions(templateId)
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) setVersions(result.data);
        else setError(result.error || "Could not load the history.");
      })
      .catch(() => !cancelled && setError("Could not load the history."));
    return () => {
      cancelled = true;
    };
  }, [isOpen, templateId, listVersions]);

  const restore = async (versionId: number) => {
    if (!templateId || !getVersion) return;
    if (isDirty && confirmId !== versionId) {
      setConfirmId(versionId);
      return;
    }
    setRestoringId(versionId);
    setError(null);
    try {
      const result = await getVersion(templateId, versionId);
      if (!result.success || !result.data) {
        setError(result.error || "Could not load this version.");
        return;
      }
      restoreVersion(result.data);
      onClose();
    } catch {
      setError("Could not load this version.");
    } finally {
      setRestoringId(null);
      setConfirmId(null);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      disableAnimation={true}
      title="Version history"
      description="Every save is kept. Restore loads a version into the editor; save to make it the current one."
    >
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {versions === null && !error && <p className={styles.muted}>Loading…</p>}

      {versions?.length === 0 && (
        <p className={styles.muted}>No versions yet. The first one is kept when you save.</p>
      )}

      {versions && versions.length > 0 && (
        <ul className={styles.list}>
          {versions.map((v, i) => {
            const author = authorLabel(v.author);
            return (
              <li key={v.id} className={styles.item}>
                <div className={styles.info}>
                  <div className={styles.title}>
                    <span className={styles.number}>v{v.version}</span>
                    {i === 0 && <span className={styles.latest}>Latest</span>}
                    <span className={styles.subject} title={v.subject}>
                      {v.subject}
                    </span>
                  </div>
                  <div className={styles.meta}>
                    {new Date(v.createdAt).toLocaleString()} · {SOURCE_LABELS[v.source] ?? v.source}
                    {author && ` · ${author}`}
                  </div>
                  {confirmId === v.id && (
                    <div className={styles.confirm} role="alert">
                      Your unsaved changes will be replaced. Undo brings the design back, but not the subject.
                    </div>
                  )}
                </div>
                <Button
                  variant={confirmId === v.id ? "primary" : "outline"}
                  size="sm"
                  onClick={() => restore(v.id)}
                  disabled={restoringId !== null}
                >
                  {restoringId === v.id ? "Loading…" : confirmId === v.id ? "Replace" : "Restore"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
};
