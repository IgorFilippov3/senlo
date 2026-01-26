"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  FormField,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@senlo/ui";
import { Settings2, Bot } from "lucide-react";
import { Project, EmailProvider, AiProvider } from "@senlo/core";
import { logger } from "apps/web/lib/logger";
import { useUpdateProject } from "apps/web/queries/projects";

interface EditProjectDialogProps {
  project: Project;
  providers: EmailProvider[];
  aiProviders: AiProvider[];
}

export function EditProjectDialog({
  project,
  providers,
  aiProviders,
}: EditProjectDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { mutate: updateProject, isPending: isUpdating } = useUpdateProject();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    updateProject(
      { projectId: project.id, formData },
      {
        onSuccess: () => {
          setIsOpen(false);
        },
        onError: (error) => {
          logger.error("Failed to update project from dialog", {
            projectId: project.id,
            error: error instanceof Error ? error.message : String(error),
          });
          alert("Failed to update project. Please try again.");
        },
      },
    );
  }

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        <Settings2 size={16} />
        Edit Project
      </Button>

      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Edit Project"
        description="Update your project's settings and email provider."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="Project Name"
            required
            hint="Update the internal name of this project"
          >
            <Input
              name="name"
              defaultValue={project.name}
              placeholder="My SaaS Launch"
              required
              autoFocus
            />
          </FormField>

          <FormField
            label="Description (optional)"
            hint="Update the description of this project"
          >
            <Textarea
              name="description"
              defaultValue={project.description || ""}
              placeholder="Email campaigns for the launch..."
              rows={3}
            />
          </FormField>

          <FormField
            label="Email Provider"
            hint="Select the email provider for sending campaigns from this project"
          >
            <Select
              name="providerId"
              defaultValue={project.providerId?.toString() || "none"}
            >
              <SelectTrigger>
                <SelectValue placeholder="— No provider selected —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No provider selected —</SelectItem>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id.toString()}>
                    {provider.name} ({provider.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {providers.length === 0 && (
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
              No email providers configured yet. Go to{" "}
              <a href="/providers" className="underline font-medium">
                Providers
              </a>{" "}
              to add one.
            </p>
          )}

          <FormField
            label="AI Provider"
            hint="Select the AI provider for template generation in this project"
          >
            <Select
              name="aiProviderId"
              defaultValue={project.aiProviderId?.toString() || "none"}
            >
              <SelectTrigger>
                <SelectValue placeholder="— No AI provider selected —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  — No AI provider selected —
                </SelectItem>
                {aiProviders.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id.toString()}>
                    {provider.name} ({provider.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {aiProviders.length === 0 && (
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
              No AI providers configured yet. Go to{" "}
              <a href="/providers" className="underline font-medium">
                Providers
              </a>{" "}
              to add one.
            </p>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Update Project"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
