"use client";

import React, { useState } from "react";
import type { Project, PublicAiProvider, PublicEmailProvider } from "@senlo/core";
import { Button, Dialog } from "@senlo/ui";
import { FormErrorBanner } from "../shared";
import {
  WorkspaceFields,
  type WorkspaceFieldsProps,
  type WorkspaceFormValues,
  workspaceFormValues,
} from "./WorkspaceFields";

export interface EditWorkspaceDialogProps {
  workspace: Project;
  emailProviders: PublicEmailProvider[];
  aiProviders: PublicAiProvider[];
  renderProvidersLink: WorkspaceFieldsProps["renderProvidersLink"];
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: WorkspaceFormValues) => void;
  isSaving?: boolean;
  error?: string | null;
}

export function EditWorkspaceDialog({
  workspace,
  emailProviders,
  aiProviders,
  renderProvidersLink,
  isOpen,
  onClose,
  onSubmit,
  isSaving = false,
  error,
}: EditWorkspaceDialogProps) {
  const [values, setValues] = useState(() => workspaceFormValues(workspace));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      disableAnimation={true}
      title="Edit Workspace"
      description="Update your workspace's settings and providers."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <WorkspaceFields
          values={values}
          onChange={setValues}
          emailProviders={emailProviders}
          aiProviders={aiProviders}
          renderProvidersLink={renderProvidersLink}
          autoFocus
        />

        <FormErrorBanner error={error} />

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving || !values.name.trim()}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
