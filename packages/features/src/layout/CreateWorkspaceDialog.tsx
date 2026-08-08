"use client";

import React from "react";
import { Button, Dialog, FormField, Input, Textarea } from "@senlo/ui";

export interface CreateWorkspaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  isLoading?: boolean;
}

export function CreateWorkspaceDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: CreateWorkspaceDialogProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    onSubmit(formData);
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
        <FormField
          label="Workspace Name"
          required
          hint="Give your workspace a descriptive name"
        >
          <Input
            name="name"
            placeholder="e.g. Marketing Q1 2024"
            required
            autoFocus
          />
        </FormField>

        <FormField
          label="Description (optional)"
          hint="Describe the purpose of this workspace"
        >
          <Textarea
            name="description"
            placeholder="e.g. All email campaigns related to the Q1 product launch..."
            rows={3}
          />
        </FormField>

        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Workspace"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
