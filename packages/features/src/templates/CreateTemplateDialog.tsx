"use client";

import React from "react";
import { Button, Dialog, FormField, Input } from "@senlo/ui";
import { FormErrorBanner } from "../shared/FormErrorBanner";
import { readForm } from "../shared/readForm";

/** What the form submits; `EmailTemplateService.create` validates it. */
export interface CreateTemplateValues {
  name: string;
  subject: string;
  locale: string;
}

export interface CreateTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: CreateTemplateValues) => void;
  isLoading?: boolean;
  /** A create failure, shown above the buttons. */
  error?: string | null;
}

export function CreateTemplateDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  error,
}: CreateTemplateDialogProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fields = readForm(e.currentTarget);
    onSubmit({
      name: fields.name ?? "",
      subject: fields.subject ?? "",
      locale: fields.locale ?? "",
    });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      disableAnimation={true}
      title="Create New Template"
      description="Templates are the building blocks of your email campaigns."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label="Template Name"
          required
          hint="Internal name for the template"
        >
          <Input
            name="name"
            placeholder="e.g. Welcome Email"
            required
            autoFocus
          />
        </FormField>

        <FormField
          label="Email Subject"
          required
          hint="The subject line recipients will see"
        >
          <Input name="subject" placeholder="e.g. Welcome to Senlo!" required />
        </FormField>

        <FormField
          label="Locale"
          required
          hint="The language of this template (e.g. en, ru, es)"
        >
          <Input name="locale" defaultValue="en" placeholder="en" required />
        </FormField>

        <FormErrorBanner error={error} />

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
            {isLoading ? "Creating..." : "Create Template"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
