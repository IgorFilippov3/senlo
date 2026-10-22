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
import type { EmailProviderType, PublicEmailProvider } from "@senlo/core";
import { FormErrorBanner } from "../shared";

export interface EmailProviderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The provider being edited; a new provider is created when absent. */
  provider?: PublicEmailProvider;
  /** Receives the form's fields as the provider services expect them. */
  onSubmit: (formData: FormData) => void;
  isSubmitting?: boolean;
  /** A message from the server, shown above the buttons. */
  error?: string | null;
}

/**
 * Create or edit a sending provider. Stored credentials never reach the
 * form: on edit, an empty secret field keeps the saved value.
 */
export function EmailProviderDialog({
  isOpen,
  onClose,
  provider,
  onSubmit,
  isSubmitting = false,
  error,
}: EmailProviderDialogProps) {
  const isEdit = !!provider;
  // Nothing stored can be kept: every field is required, as for a new provider.
  const mustReenter = !!provider?.configUnreadable;
  const [type, setType] = useState<EmailProviderType>(provider?.type ?? "RESEND");
  const config = provider?.config ?? {};
  const text = (key: string, fallback = "") =>
    config[key] !== undefined ? String(config[key]) : fallback;

  /** Saved for this provider: optional on edit, the stored value stays. */
  const isSet = (key: string) => !!provider?.secretsSet.includes(key);

  const secret = (
    name: string,
    configKey: string,
    label: string,
    hint: string,
    placeholder: string,
    optional = false,
  ) => {
    const saved = isSet(configKey);
    return (
      <FormField
        label={label}
        required={!optional && !saved}
        hint={saved ? "Saved. Leave empty to keep it." : hint}
      >
        <Input
          name={name}
          type="password"
          placeholder={saved ? "••••••••" : placeholder}
          required={!optional && !saved}
          autoComplete="new-password"
        />
      </FormField>
    );
  };

  const webhookSecret = (hint: string, placeholder: string) => (
    <>
      {secret("webhookSecret", "webhook_secret", "Webhook Secret", hint, placeholder, true)}
      {isSet("webhook_secret") && (
        <label className="flex items-center gap-2 text-sm text-zinc-600 -mt-2">
          <input type="checkbox" name="clearWebhookSecret" className="rounded border-zinc-300" />
          Remove the saved webhook secret
        </label>
      )}
    </>
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(new FormData(e.currentTarget));
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      disableAnimation={true}
      title={isEdit ? "Edit Email Provider" : "Add Email Provider"}
      description={
        mustReenter
          ? "The saved credentials can't be decrypted. Enter them again to use this provider."
          : isEdit
            ? "Update your email provider configuration."
            : "Configure a new email sending provider."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Display Name" required hint="Internal name for this provider">
          <Input
            name="name"
            defaultValue={provider?.name}
            placeholder={type === "SMTP" ? "My mail server" : "My Resend Account"}
            required
            autoFocus
          />
        </FormField>

        <FormField label="Provider Type" required>
          <Select name="type" value={type} onValueChange={(val) => setType(val as EmailProviderType)}>
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
            {secret("apiKey", "apiKey", "API Key", "Your Resend API Key (re_...)", "re_123456789")}
            {webhookSecret("Svix signing secret for delivery tracking", "whsec_...")}
          </>
        )}

        {type === "MAILGUN" && (
          <>
            {secret("apiKey", "apiKey", "API Key", "Your Mailgun Private API Key", "key-xxxxxxxx")}
            <FormField label="Sending Domain" required hint="Your verified Mailgun domain">
              <Input name="domain" defaultValue={text("domain")} placeholder="mg.example.com" required />
            </FormField>
            <FormField label="Region" hint="Choose based on your Mailgun account region">
              <Select name="region" defaultValue={text("region", "US")}>
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
            <FormField label="Access Key ID" required={!isEdit || mustReenter} hint="AWS IAM User Access Key ID">
              <Input
                name="accessKeyId"
                defaultValue={text("accessKeyId")}
                placeholder="AKIA..."
                required={!isEdit || mustReenter}
              />
            </FormField>
            {secret(
              "secretAccessKey",
              "secretAccessKey",
              "Secret Access Key",
              "AWS IAM User Secret Access Key",
              "xxxxxxxx",
            )}
            <FormField label="Region" required hint="AWS Region where SES is configured">
              <Input name="region" defaultValue={text("region")} placeholder="us-east-1" required />
            </FormField>
          </>
        )}

        {type === "POSTMARK" && (
          <>
            {secret(
              "serverToken",
              "serverToken",
              "Server API Token",
              "Your Postmark Server API Token",
              "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            )}
            {webhookSecret(
              "Needed for delivery, bounce and open events: Senlo ignores Postmark webhooks without it. In Postmark, add a custom header X-Postmark-Secret with this value to the webhook.",
              "my-secret-token",
            )}
          </>
        )}

        {type === "SMTP" && (
          <>
            <FormField label="Host" required hint="Hostname of your mail server">
              <Input name="host" defaultValue={text("host")} placeholder="smtp.example.com" required />
            </FormField>

            <FormField label="Port" required hint="587 with STARTTLS, or 465 with SSL/TLS">
              <Input name="port" type="number" defaultValue={text("port", "587")} required />
            </FormField>

            <FormField
              label="Encryption"
              hint="Match this to the port. Sending unencrypted exposes both the message and the password to anything on the network."
            >
              <Select name="encryption" defaultValue={text("encryption", "starttls")}>
                <SelectTrigger>
                  <SelectValue placeholder="Encryption" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starttls">STARTTLS — usually port 587</SelectItem>
                  <SelectItem value="ssl">SSL/TLS — usually port 465</SelectItem>
                  <SelectItem value="none">None — unencrypted</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="Username"
              hint="Leave empty if your relay accepts mail without authentication"
            >
              <Input name="username" defaultValue={text("username")} placeholder="you@example.com" />
            </FormField>

            {secret(
              "password",
              "password",
              "Password",
              "Leave empty if the relay does not require authentication",
              "••••••••",
              true,
            )}
          </>
        )}

        <FormErrorBanner error={error} />

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Create Provider"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
