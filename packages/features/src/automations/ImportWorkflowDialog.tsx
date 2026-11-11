// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import {
  exportEmailRefs,
  exportSecretHeaders,
  parseWorkflowExport,
  type Workflow,
  type WorkflowExport,
} from "@senlo/core";
import { Button, Dialog, Input } from "@senlo/ui";
import { useProjectCampaigns } from "../data/campaigns";
import { WorkflowNotReadyError, useImportWorkflow } from "../data/workflows";
import { LazyWorkflowPreview } from "./LazyWorkflowPreview";

const NONE = "";

/**
 * Import an automation from an export file: read it, map each email it
 * sends to a trigger of this workspace (matched by name where one exists),
 * then create a draft. Header values of HTTP steps are entered again in the
 * editor (they never leave the instance they were saved on).
 */
export function ImportWorkflowDialog({
  isOpen,
  onClose,
  projectId,
  onImported,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onImported: (workflow: Workflow) => void;
}) {
  const { data: campaigns = [] } = useProjectCampaigns(projectId);
  const triggers = campaigns.filter((c) => c.type === "TRIGGERED");
  const importWorkflow = useImportWorkflow(projectId);
  const [file, setFile] = useState<WorkflowExport | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[] | null>(null);

  const reset = () => {
    setFile(null);
    setFileError(null);
    setName("");
    setEmails({});
    setErrors(null);
    importWorkflow.reset();
  };

  const close = () => {
    reset();
    onClose();
  };

  const read = async (picked: File | undefined) => {
    reset();
    if (!picked) return;
    let raw: unknown;
    try {
      raw = JSON.parse(await picked.text());
    } catch {
      setFileError("The file is not JSON.");
      return;
    }
    const parsed = parseWorkflowExport(raw);
    if (!parsed.success) {
      setFileError(parsed.error);
      return;
    }
    setFile(parsed.data);
    setName(parsed.data.name);
    // Matched by name where this workspace has a trigger with it.
    const matched: Record<string, string> = {};
    for (const ref of exportEmailRefs(parsed.data)) {
      const trigger =
        triggers.find((t) => t.name === ref) ?? triggers.find((t) => t.name.toLowerCase() === ref.toLowerCase());
      matched[ref] = trigger ? String(trigger.id) : NONE;
    }
    setEmails(matched);
  };

  const submit = async () => {
    if (!file) return;
    setErrors(null);
    try {
      const workflow = await importWorkflow.mutateAsync({
        workflow: file,
        name: name.trim() || undefined,
        emails: Object.fromEntries(Object.entries(emails).map(([ref, id]) => [ref, id === NONE ? null : Number(id)])),
      });
      reset();
      onImported(workflow);
    } catch (error) {
      setErrors(error instanceof WorkflowNotReadyError ? error.reasons : [(error as Error).message]);
    }
  };

  const refs = file ? exportEmailRefs(file) : [];
  const headers = file ? exportSecretHeaders(file) : [];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={close}
      title="Import automation"
      description="Create a draft from an automation exported from Senlo."
      size={file ? "lg" : "default"}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!file || importWorkflow.isPending}>
            {importWorkflow.isPending ? "Importing..." : "Import as draft"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => void read(e.target.files?.[0])}
          className="text-sm"
          aria-label="Export file"
        />
        {fileError && <p className="text-sm text-red-600">{fileError}</p>}

        {file && (
          <>
            <LazyWorkflowPreview nodes={file.nodes} edges={file.edges} className="h-[300px]" />
            <label className="block space-y-1">
              <span className="text-sm font-medium text-gray-900">Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            {refs.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">Emails</p>
                <p className="text-xs text-gray-500">
                  Which trigger of this workspace each email step sends. Left empty, the step asks you to choose one.
                </p>
                {refs.map((ref) => (
                  <div key={ref} className="flex items-center gap-2">
                    <span className="text-sm text-gray-700 w-1/2 truncate" title={ref}>
                      {ref}
                    </span>
                    <select
                      className="h-9 flex-1 rounded-md border border-gray-200 px-2 text-sm"
                      value={emails[ref] ?? NONE}
                      onChange={(e) => setEmails({ ...emails, [ref]: e.target.value })}
                      aria-label={`Trigger for ${ref}`}
                    >
                      <option value={NONE}>Leave empty</option>
                      {triggers.map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {headers.length > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                Header values are not exported. Enter them again in the HTTP request steps before going live:{" "}
                {headers.map((h) => h.name).join(", ")}.
              </p>
            )}
          </>
        )}

        {errors && errors.length > 0 && (
          <ul className="list-disc pl-4 text-sm text-red-600 space-y-1">
            {errors.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
