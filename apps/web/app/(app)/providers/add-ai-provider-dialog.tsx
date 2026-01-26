"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@senlo/ui";
import { Plus } from "lucide-react";
import { useCreateAiProvider } from "apps/web/queries/ai-providers";
import type { AiProviderType } from "@senlo/core";

interface ValidationError {
  error: {
    fieldErrors: Record<string, string[] | undefined>;
    formErrors: string[];
  };
}

export function AddAiProviderDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<AiProviderType>("OPENAI");
  const { mutate: createAiProvider } = useCreateAiProvider();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    createAiProvider(formData, {
      onSuccess: () => {
        setIsOpen(false);
        setType("OPENAI");
        form.reset();
      },
      onError: (error) => {
        const validationError = error as unknown as ValidationError;
        if (validationError?.error?.fieldErrors) {
          const fieldErrors = validationError.error.fieldErrors;
          let errorMessage = "Validation failed";

          if ("name" in fieldErrors && fieldErrors.name?.[0]) {
            errorMessage = fieldErrors.name[0];
          } else if ("type" in fieldErrors && fieldErrors.type?.[0]) {
            errorMessage = fieldErrors.type[0];
          } else if ("apiKey" in fieldErrors && fieldErrors.apiKey?.[0]) {
            errorMessage = fieldErrors.apiKey[0];
          } else if ("general" in fieldErrors && fieldErrors.general?.[0]) {
            errorMessage = fieldErrors.general[0];
          }

          alert(`Error: ${errorMessage}`);
        } else {
          alert("Failed to create AI provider. Please try again.");
        }
      },
    });
  };

  const handleClose = () => {
    setIsOpen(false);
    setType("OPENAI");
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Plus size={16} />
        Add AI Provider
      </Button>

      <Dialog
        isOpen={isOpen}
        onClose={handleClose}
        title="Add AI Provider"
        description="Configure a new AI model provider for template generation."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="Display Name"
            required
            hint="Internal name for this provider"
          >
            <Input
              name="name"
              placeholder={
                type === "OPENAI" ? "My OpenAI API Key" : "My Anthropic Key"
              }
              required
              autoFocus
              autoComplete="off"
            />
          </FormField>

          <FormField label="Provider Type" required>
            <Select
              name="type"
              value={type}
              onValueChange={(val) => setType(val as AiProviderType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPENAI">OpenAI</SelectItem>
                <SelectItem value="ANTHROPIC">Anthropic</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="API Key"
            required
            hint={
              type === "OPENAI"
                ? "Your OpenAI API Key (sk-...)"
                : "Your Anthropic API Key (sk-ant-...)"
            }
          >
            <Input
              name="apiKey"
              type="password"
              placeholder="sk-..."
              required
              autoComplete="new-password"
            />
          </FormField>

          <FormField
            label="Default Model"
            hint={
              type === "OPENAI"
                ? "e.g. gpt-4o, gpt-4-turbo"
                : "e.g. claude-3-5-sonnet-20240620"
            }
          >
            <Input
              name="model"
              placeholder={
                type === "OPENAI" ? "gpt-4o" : "claude-3-5-sonnet-20240620"
              }
              autoComplete="off"
            />
          </FormField>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit">Create Provider</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
