"use client";

import React, { useState } from "react";
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
import { DEFAULT_AI_MODELS, type AiProviderType } from "@senlo/core";
import { FormErrorBanner } from "../shared";

export interface AiProviderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

export function AiProviderDialog({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  error,
}: AiProviderDialogProps) {
  const [type, setType] = useState<AiProviderType>("OPENAI");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(new FormData(e.currentTarget));
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      disableAnimation={true}
      title="Add AI Provider"
      description="Configure a new AI model provider for template generation."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Display Name" required hint="Internal name for this provider">
          <Input
            name="name"
            placeholder={type === "OPENAI" ? "My OpenAI API Key" : "My Anthropic Key"}
            required
            autoFocus
            autoComplete="off"
          />
        </FormField>

        <FormField label="Provider Type" required>
          <Select name="type" value={type} onValueChange={(val) => setType(val as AiProviderType)}>
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

        <FormField label="Default Model" hint={`Leave empty for ${DEFAULT_AI_MODELS[type]}`}>
          <Input name="model" placeholder={DEFAULT_AI_MODELS[type]} autoComplete="off" />
        </FormField>

        <FormErrorBanner error={error} />

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Create Provider"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
