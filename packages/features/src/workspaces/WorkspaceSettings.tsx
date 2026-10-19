"use client";

import React, { useState } from "react";
import type { Project, PublicAiProvider, PublicEmailProvider } from "@senlo/core";
import { Button, Card } from "@senlo/ui";
import { AlertTriangle, Save, Trash2 } from "lucide-react";
import { FormErrorBanner } from "../shared";
import {
  WorkspaceFields,
  type WorkspaceFieldsProps,
  type WorkspaceFormValues,
  isWorkspaceFormChanged,
  workspaceFormValues,
} from "./WorkspaceFields";

export interface WorkspaceSettingsProps {
  workspace: Project;
  emailProviders: PublicEmailProvider[];
  aiProviders: PublicAiProvider[];
  renderProvidersLink: WorkspaceFieldsProps["renderProvidersLink"];
  onSave: (values: WorkspaceFormValues) => void;
  /** Asks for confirmation; the app opens the delete dialog. */
  onDelete: () => void;
  isSaving?: boolean;
  error?: string | null;
}

export function WorkspaceSettings({
  workspace,
  emailProviders,
  aiProviders,
  renderProvidersLink,
  onSave,
  onDelete,
  isSaving = false,
  error,
}: WorkspaceSettingsProps) {
  const [values, setValues] = useState(() => workspaceFormValues(workspace));
  const canSave = !!values.name.trim() && isWorkspaceFormChanged(workspace, values) && !isSaving;

  return (
    <div className="space-y-8">
      <Card className="p-6 border-zinc-200 shadow-sm">
        <h3 className="text-lg font-medium mb-6">General Settings</h3>
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) onSave(values);
          }}
        >
          <WorkspaceFields
            values={values}
            onChange={setValues}
            emailProviders={emailProviders}
            aiProviders={aiProviders}
            renderProvidersLink={renderProvidersLink}
          />

          <FormErrorBanner error={error} />

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={!canSave} className="gap-2">
              <Save size={16} />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6 border-red-100 bg-red-50/30 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-red-100 rounded-lg text-red-600 flex-shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-red-900 mb-2">Danger Zone</h3>
            <p className="text-sm text-red-700 mb-6">
              Deleting this workspace will permanently remove all associated templates, triggers,
              contacts, and logs. This action is irreversible.
            </p>
            <Button variant="destructive" onClick={onDelete} className="gap-2">
              <Trash2 size={16} />
              Delete Workspace
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
