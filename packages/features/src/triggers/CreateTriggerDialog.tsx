"use client";

import React from "react";
import { Button, Dialog, FormField, Input, Textarea, JsonEditor } from "@senlo/ui";

export interface CreateTriggerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  isLoading?: boolean;
}

export function CreateTriggerDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: CreateTriggerDialogProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("type", "TRIGGERED");
    onSubmit(formData);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      disableAnimation={true}
      title="Create New Trigger"
      description="Configure your email trigger to start sending emails via API."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label="Trigger Name"
          required
          hint="Give your trigger a descriptive name"
        >
          <Input
            name="name"
            placeholder="e.g. Welcome Email"
            required
            autoFocus
          />
        </FormField>

        <FormField
          label="Description (optional)"
        >
          <Textarea
            name="description"
            placeholder="e.g. Sent when a new user signs up..."
            rows={2}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="From Name">
            <Input name="fromName" placeholder="e.g. Igor from Senlo" />
          </FormField>
          <FormField label="From Email">
            <Input name="fromEmail" placeholder="e.g. hello@senlo.io" />
          </FormField>
        </div>

        <FormField
          label="Sample JSON Data (optional)"
          hint="Define variables for the editor"
        >
          <div className="border border-zinc-200 rounded-md overflow-hidden">
             {/* Note: JsonEditor needs a name if we use FormData, but it's a controlled component usually. 
                 In a dialog, we might need state for it. */}
             <JsonEditor
               value="{}"
               onChange={() => {}}
               height="120px"
             />
             <input type="hidden" name="variablesSchema" value="{}" />
          </div>
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
            {isLoading ? "Creating..." : "Create Trigger"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
