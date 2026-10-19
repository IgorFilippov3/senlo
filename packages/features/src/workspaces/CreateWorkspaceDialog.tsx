"use client";

import React, { useState } from "react";
import { Button, Dialog, FormField, Input, Textarea } from "@senlo/ui";
import { FormErrorBanner } from "../shared";

export interface CreateWorkspaceValues {
  name: string;
  description: string;
}

export interface CreateWorkspaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: CreateWorkspaceValues) => void;
  isLoading?: boolean;
  /** Server message from the last attempt. */
  error?: string | null;
}

export function CreateWorkspaceDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  error,
}: CreateWorkspaceDialogProps) {
  const [values, setValues] = useState<CreateWorkspaceValues>({ name: "", description: "" });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      disableAnimation={true}
      title="Create New Workspace"
      description="Workspaces help you organize your email templates and campaigns."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Workspace Name" required hint="Give your workspace a descriptive name">
          <Input
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            placeholder="e.g. Marketing Q1"
            required
            autoFocus
          />
        </FormField>

        <FormField label="Description (optional)" hint="Describe the purpose of this workspace">
          <Textarea
            value={values.description}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
            placeholder="e.g. All email campaigns related to the product launch..."
            rows={3}
          />
        </FormField>

        <FormErrorBanner error={error} />

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || !values.name.trim()}>
            {isLoading ? "Creating..." : "Create Workspace"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
