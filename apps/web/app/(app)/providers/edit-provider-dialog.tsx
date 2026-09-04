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
import { useUpdateProvider } from "apps/web/queries/providers";
import type { EmailProvider, EmailProviderType } from "@senlo/core";
import { CreateProviderError } from "./actions";

interface EditProviderDialogProps {
  provider: EmailProvider;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditProviderDialog({
  provider,
  isOpen,
  onClose,
}: EditProviderDialogProps) {
  const [type, setType] = useState<EmailProviderType>(provider.type);
  const { mutate: updateProvider } = useUpdateProvider();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    updateProvider(
      { id: provider.id, formData },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (error: CreateProviderError) => {
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
            } else if ("host" in fieldErrors && fieldErrors.host?.[0]) {
              errorMessage = fieldErrors.host[0];
            } else if ("port" in fieldErrors && fieldErrors.port?.[0]) {
              errorMessage = fieldErrors.port[0];
            } else if ("password" in fieldErrors && fieldErrors.password?.[0]) {
              errorMessage = fieldErrors.password[0];
            } else if ("general" in fieldErrors && fieldErrors.general?.[0]) {
              errorMessage = fieldErrors.general[0];
            }
          }

          alert(`Error: ${errorMessage}`);
        },
      },
    );
  };

  const handleInternalClose = () => {
    onClose();
    setType(provider.type);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleInternalClose}
      disableAnimation={true}
      title="Edit Email Provider"
      description="Update your email provider configuration."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label="Display Name"
          required
          hint="Internal name for this provider"
        >
          <Input
            name="name"
            defaultValue={provider.name}
            placeholder="My Account"
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
              <SelectItem value="SMTP">SMTP server</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        {type === "RESEND" && (
          <>
            <FormField label="API Key" hint="Leave empty to keep current key">
              <Input name="apiKey" type="password" placeholder="re_••••••••" />
            </FormField>

            <FormField
              label="Webhook Secret"
              hint="Svix signing secret for delivery tracking"
            >
              <Input
                name="webhookSecret"
                type="password"
                defaultValue={(provider.config.webhook_secret as string) || ""}
                placeholder="whsec_..."
              />
            </FormField>
          </>
        )}

        {type === "MAILGUN" && (
          <>
            <FormField label="API Key" hint="Leave empty to keep current key">
              <Input name="apiKey" type="password" placeholder="key-••••••••" />
            </FormField>

            <FormField
              label="Sending Domain"
              required
              hint="Your verified Mailgun domain"
            >
              <Input
                name="domain"
                defaultValue={(provider.config.domain as string) || ""}
                placeholder="mg.example.com"
                required
              />
            </FormField>

            <FormField
              label="Region"
              hint="Choose based on your Mailgun account region"
            >
              <Select
                name="region"
                defaultValue={(provider.config.region as string) || "US"}
              >
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
            <FormField label="Access Key ID" hint="Leave empty to keep current">
              <Input
                name="accessKeyId"
                defaultValue={(provider.config.accessKeyId as string) || ""}
                placeholder="AKIA..."
              />
            </FormField>

            <FormField
              label="Secret Access Key"
              hint="Leave empty to keep current"
            >
              <Input
                name="secretAccessKey"
                type="password"
                placeholder="••••••••"
              />
            </FormField>

            <FormField
              label="Region"
              required
              hint="AWS Region where SES is configured"
            >
              <Input
                name="region"
                defaultValue={(provider.config.region as string) || ""}
                placeholder="us-east-1"
                required
              />
            </FormField>
          </>
        )}
        {type === "POSTMARK" && (
          <>
            <FormField
              label="Server API Token"
              hint="Leave empty to keep current token"
            >
              <Input
                name="serverToken"
                type="password"
                placeholder="••••••••-••••-••••-••••-••••••••••••"
              />
            </FormField>

            <FormField
              label="Webhook Secret"
              hint="Optional: A secret to verify webhooks (sent in X-Postmark-Secret header)"
            >
              <Input
                name="webhookSecret"
                type="password"
                defaultValue={(provider.config.webhook_secret as string) || ""}
                placeholder="my-secret-token"
              />
            </FormField>
          </>
        )}

        {type === "SMTP" && (
          <>
            <FormField label="Host" required hint="Hostname of your mail server">
              <Input
                name="host"
                defaultValue={provider.config.host ?? ""}
                placeholder="smtp.example.com"
                required
              />
            </FormField>

            <FormField
              label="Port"
              required
              hint="587 with STARTTLS, or 465 with SSL/TLS"
            >
              <Input
                name="port"
                type="number"
                defaultValue={String(provider.config.port ?? 587)}
                required
              />
            </FormField>

            <FormField
              label="Encryption"
              hint="Match this to the port. Sending unencrypted exposes both the message and the password to anything on the network."
            >
              <Select
                name="encryption"
                defaultValue={provider.config.encryption ?? "starttls"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Encryption" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starttls">
                    STARTTLS — usually port 587
                  </SelectItem>
                  <SelectItem value="ssl">
                    SSL/TLS — usually port 465
                  </SelectItem>
                  <SelectItem value="none">None — unencrypted</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="Username"
              hint="Leave empty if your relay accepts mail without authentication"
            >
              <Input
                name="username"
                defaultValue={provider.config.username ?? ""}
                placeholder="you@example.com"
              />
            </FormField>

            <FormField
              label="Password"
              hint="Leave empty to keep the password already saved"
            >
              <Input name="password" type="password" placeholder="••••••••" />
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
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Dialog>
  );
}
