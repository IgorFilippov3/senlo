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
import { useCreateProvider } from "apps/web/queries/providers";
import type { EmailProviderType } from "@senlo/core";

export function AddProviderDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<EmailProviderType>("RESEND");
  const { mutate: createProvider } = useCreateProvider();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    createProvider(formData, {
      onSuccess: () => {
        setIsOpen(false);
        setType("RESEND");
        form.reset();
      },
      onError: (error) => {
        // Handle field errors from the server action
        if (
          error &&
          typeof error === "object" &&
          "error" in error &&
          error.error
        ) {
          const fieldErrors = (error.error as any).fieldErrors;
          let errorMessage = "Validation failed";

          if (fieldErrors) {
            if ("name" in fieldErrors && fieldErrors.name?.[0]) {
              errorMessage = fieldErrors.name[0];
            } else if ("type" in fieldErrors && fieldErrors.type?.[0]) {
              errorMessage = fieldErrors.type[0];
            } else if ("apiKey" in fieldErrors && fieldErrors.apiKey?.[0]) {
              errorMessage = fieldErrors.apiKey[0];
            } else if ("domain" in fieldErrors && fieldErrors.domain?.[0]) {
              errorMessage = fieldErrors.domain[0];
            } else if ("general" in fieldErrors && fieldErrors.general?.[0]) {
              errorMessage = fieldErrors.general[0];
            }
          }

          alert(`Error: ${errorMessage}`);
        } else {
          alert("Failed to create provider. Please try again.");
        }
      },
    });
  };

  const handleClose = () => {
    setIsOpen(false);
    setType("RESEND");
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Plus size={16} />
        Add Provider
      </Button>

      <Dialog
        isOpen={isOpen}
        onClose={handleClose}
        title="Add Email Provider"
        description="Configure a new email sending provider."
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
                type === "MAILGUN" ? "My Mailgun Account" : "My Resend Account"
              }
              required
              autoFocus
            />
          </FormField>

          <FormField label="Provider Type" required>
            <Select
              name="type"
              value={type}
              onValueChange={(val) => setType(val as EmailProviderType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RESEND">Resend</SelectItem>
                <SelectItem value="MAILGUN">Mailgun</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          {type === "RESEND" && (
            <FormField
              label="API Key"
              required
              hint="Your Resend API Key (re_...)"
            >
              <Input
                name="apiKey"
                type="password"
                placeholder="re_123456789"
                required
              />
            </FormField>
          )}

          {type === "MAILGUN" && (
            <>
              <FormField
                label="API Key"
                required
                hint="Your Mailgun Private API Key"
              >
                <Input
                  name="apiKey"
                  type="password"
                  placeholder="key-xxxxxxxx"
                  required
                />
              </FormField>

              <FormField
                label="Sending Domain"
                required
                hint="Your verified Mailgun domain"
              >
                <Input name="domain" placeholder="mg.example.com" required />
              </FormField>

              <FormField
                label="Region"
                hint="Choose based on your Mailgun account region"
              >
                <Select name="region" defaultValue="US">
                  <SelectTrigger>
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">US (api.mailgun.net)</SelectItem>
                    <SelectItem value="EU">EU (api.eu.mailgun.net)</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </>
          )}

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
