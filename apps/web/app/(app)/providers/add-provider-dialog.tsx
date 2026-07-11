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
import { useCreateProvider } from "apps/web/queries/providers";
import type { EmailProviderType } from "@senlo/core";
import { CreateProviderError } from "./actions";

interface AddProviderDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddProviderDialog({
  isOpen,
  onClose,
}: AddProviderDialogProps) {
  const [type, setType] = useState<EmailProviderType>("RESEND");
  const { mutate: createProvider } = useCreateProvider();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    createProvider(formData, {
      onSuccess: () => {
        onClose();
        setType("RESEND");
        form.reset();
      },
      onError: (error: CreateProviderError) => {
        // Handle field errors from the server action
        const fieldErrors = error.error?.fieldErrors;
        let errorMessage = "Validation failed";

        if (fieldErrors) {
          if ("name" in fieldErrors && fieldErrors.name?.[0]) {
            errorMessage = fieldErrors.name[0];
          } else if ("type" in fieldErrors && fieldErrors.type?.[0]) {
            errorMessage = fieldErrors.type[0];
          } else if ("apiKey" in fieldErrors && fieldErrors.apiKey?.[0]) {
            errorMessage = fieldErrors.apiKey[0];
          } else if (
            "webhookSecret" in fieldErrors &&
            fieldErrors.webhookSecret?.[0]
          ) {
            errorMessage = fieldErrors.webhookSecret[0];
          } else if ("domain" in fieldErrors && fieldErrors.domain?.[0]) {
            errorMessage = fieldErrors.domain[0];
          } else if (
            "accessKeyId" in fieldErrors &&
            fieldErrors.accessKeyId?.[0]
          ) {
            errorMessage = fieldErrors.accessKeyId[0];
          } else if (
            "secretAccessKey" in fieldErrors &&
            fieldErrors.secretAccessKey?.[0]
          ) {
            errorMessage = fieldErrors.secretAccessKey[0];
          } else if (
            "serverToken" in fieldErrors &&
            fieldErrors.serverToken?.[0]
          ) {
            errorMessage = fieldErrors.serverToken[0];
          } else if ("general" in fieldErrors && fieldErrors.general?.[0]) {
            errorMessage = fieldErrors.general[0];
          }
        }

        alert(`Error: ${errorMessage}`);
      },
    });
  };

  const handleInternalClose = () => {
    onClose();
    setType("RESEND");
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleInternalClose}
      disableAnimation={true}
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
              {/* <SelectItem value="MAILGUN">Mailgun</SelectItem> */}
              {/* <SelectItem value="SES">Amazon SES</SelectItem> */}
              <SelectItem value="POSTMARK">Postmark</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        {type === "RESEND" && (
          <>
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

            <FormField
              label="Webhook Secret"
              hint="Svix signing secret for delivery tracking"
            >
              <Input
                name="webhookSecret"
                type="password"
                placeholder="whsec_..."
              />
            </FormField>
          </>
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

        {type === "SES" && (
          <>
            <FormField
              label="Access Key ID"
              required
              hint="AWS IAM User Access Key ID"
            >
              <Input name="accessKeyId" placeholder="AKIA..." required />
            </FormField>

            <FormField
              label="Secret Access Key"
              required
              hint="AWS IAM User Secret Access Key"
            >
              <Input
                name="secretAccessKey"
                type="password"
                placeholder="xxxxxxxx"
                required
              />
            </FormField>

            <FormField
              label="Region"
              required
              hint="AWS Region where SES is configured"
            >
              <Input name="region" placeholder="us-east-1" required />
            </FormField>
          </>
        )}
        {type === "POSTMARK" && (
          <>
            <FormField
              label="Server API Token"
              required
              hint="Your Postmark Server API Token"
            >
              <Input
                name="serverToken"
                type="password"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                required
              />
            </FormField>

            <FormField
              label="Webhook Secret"
              hint="Optional: A secret to verify webhooks (sent in X-Postmark-Secret header)"
            >
              <Input
                name="webhookSecret"
                type="password"
                placeholder="my-secret-token"
              />
            </FormField>
          </>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="secondary"
            type="button"
            onClick={handleInternalClose}
          >
            Cancel
          </Button>
          <Button type="submit">Create Provider</Button>
        </div>
      </form>
    </Dialog>
  );
}
