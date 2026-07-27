"use client";

import { Button, Dialog, FormField, Input } from "@senlo/ui";
import { useCreateTemplate } from "apps/web/queries/templates";
import { logger } from "apps/web/lib/logger";

interface CreateTemplateDialogProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateTemplateDialog({
  projectId,
  isOpen,
  onClose,
}: CreateTemplateDialogProps) {
  const { mutate: createTemplate, isPending: isCreating } = useCreateTemplate();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    createTemplate(
      { projectId, formData },
      {
        onSuccess: () => {
          onClose();
          form.reset();
        },
        onError: (error) => {
          logger.error("Failed to create template", {
            projectId,
            error: error instanceof Error ? error.message : String(error),
          });
          alert("Failed to create template. Please try again.");
        },
      },
    );
  }

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

        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Template"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
