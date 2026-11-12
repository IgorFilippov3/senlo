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
import { readForm } from "../shared/readForm";

/**
 * What the form submits: the fields of the chosen type only, as typed (the
 * services coerce the port and validate everything). On edit an empty secret
 * means "keep the saved one".
 */
export interface EmailProviderValues {
  name: string;
  type: EmailProviderType;
  apiKey?: string;
  apiSecret?: string;
  accountId?: string;
  webhookSecret?: string;
  /** Edit only: remove the saved webhook secret. */
  clearWebhookSecret?: boolean;
  domain?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  serverToken?: string;
  host?: string;
  port?: string;
  encryption?: string;
  username?: string;
  password?: string;
  /** "Use in workspaces": every ticked workspace; on edit, the whole set. */
  workspaceIds?: number[];
}

const TEXT_FIELDS = [
  "apiKey",
  "apiSecret",
  "accountId",
  "webhookSecret",
  "domain",
  "region",
  "accessKeyId",
  "secretAccessKey",
  "serverToken",
  "host",
  "port",
  "encryption",
  "username",
  "password",
] as const;

/** A workspace in "Use in workspaces". */
export interface ProviderWorkspaceChoice {
  id: number;
  name: string;
  /** The provider it uses now, or null for none. */
  providerId: number | null;
  /** That provider's name, shown as "currently: …" when it is another one. */
  providerName?: string | null;
}

export interface EmailProviderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The provider being edited; a new provider is created when absent. */
  provider?: PublicEmailProvider;
  onSubmit: (values: EmailProviderValues) => void;
  isSubmitting?: boolean;
  /** A message from the server, shown above the buttons. */
  error?: string | null;
  /**
   * The user's workspaces, for "Use in workspaces". Absent (still loading):
   * the block is hidden and the save sends no `workspaceIds`, so no
   * workspace changes.
   */
  workspaces?: ProviderWorkspaceChoice[];
  /**
   * Set after a save the provider could not confirm (no answer, a timeout,
   * an ambiguous refusal): the provider is saved; the dialog says so instead
   * of closing, and offers only Done.
   */
  savedWarning?: string | null;
}

/**
 * Ticked when the dialog opens: on create, every workspace without a
 * provider (the first provider then just works); on edit, the ones that use
 * this provider now.
 */
export function initialWorkspaceSelection(
  workspaces: ProviderWorkspaceChoice[],
  providerId: number | undefined,
): number[] {
  return workspaces
    .filter((w) => (providerId === undefined ? w.providerId === null : w.providerId === providerId))
    .map((w) => w.id);
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
  workspaces,
  savedWarning,
}: EmailProviderDialogProps) {
  const isEdit = !!provider;
  // Set once, from the first list that arrives: a refetch must not undo the user's ticks.
  const [selected, setSelected] = useState<number[] | null>(null);
  const ticked = selected ?? (workspaces ? initialWorkspaceSelection(workspaces, provider?.id) : []);
  const toggleWorkspace = (id: number) =>
    setSelected(ticked.includes(id) ? ticked.filter((w) => w !== id) : [...ticked, id]);
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

  const webhookSecret = (hint: string, placeholder: string, label = "Webhook Secret") => (
    <>
      {secret("webhookSecret", "webhook_secret", label, hint, placeholder, true)}
      {isSet("webhook_secret") && (
        <label className="flex items-center gap-2 text-sm text-zinc-600 -mt-2">
          <input type="checkbox" name="clearWebhookSecret" className="rounded border-zinc-300" />
          Remove the saved {label.toLowerCase()}
        </label>
      )}
    </>
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Already saved: Enter in a field must not save (or create) it again.
    if (savedWarning) return;
    const fields = readForm(e.currentTarget);
    const values: EmailProviderValues = { name: fields.name ?? "", type };
    for (const key of TEXT_FIELDS) {
      if (fields[key] !== undefined) values[key] = fields[key];
    }
    if (fields.clearWebhookSecret !== undefined) values.clearWebhookSecret = true;
    if (workspaces) values.workspaceIds = ticked;
    onSubmit(values);
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
              <SelectItem value="SENDGRID">SendGrid</SelectItem>
              <SelectItem value="MAILJET">Mailjet</SelectItem>
              <SelectItem value="CLOUDFLARE">Cloudflare Email</SelectItem>
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

        {type === "SENDGRID" && (
          <>
            {secret("apiKey", "apiKey", "API Key", "A SendGrid API key with Mail Send access", "SG.xxxxxxxx")}
            <FormField label="Region" hint="EU only for an account or subuser with EU data residency">
              <Select name="region" defaultValue={text("region", "US")}>
                <SelectTrigger>
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">Global (api.sendgrid.com)</SelectItem>
                  <SelectItem value="EU">EU (api.eu.sendgrid.com)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            {webhookSecret(
              "Needed for delivery, bounce and spam events: the Verification Key of your Signed Event Webhook in SendGrid. Senlo refuses SendGrid webhooks without it.",
              "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...",
              "Verification Key",
            )}
          </>
        )}

        {type === "MAILJET" && (
          <>
            {secret("apiKey", "apiKey", "API Key", "Your Mailjet API Key (public half of the key pair)", "xxxxxxxx")}
            {secret("apiSecret", "apiSecret", "Secret Key", "Your Mailjet Secret Key", "xxxxxxxx")}
            <FormField label="Region" hint="US only for an account on Mailjet's US infrastructure">
              <Select name="region" defaultValue={text("region", "GLOBAL")}>
                <SelectTrigger>
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GLOBAL">Global (api.mailjet.com)</SelectItem>
                  <SelectItem value="US">US (api.us.mailjet.com)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            {webhookSecret(
              "Needed for delivery, bounce and spam events: Senlo refuses Mailjet webhooks without it. Letters, digits, - and _ only (e.g. openssl rand -hex 32): it goes into the callback URL as the basic auth password, https://senlo:<secret>@your-host/api/webhooks/mailjet.",
              "a long random string",
            )}
          </>
        )}

        {type === "CLOUDFLARE" && (
          <>
            {secret("apiKey", "apiKey", "API Token", "A Cloudflare API token allowed to send email for the account", "xxxxxxxx")}
            <FormField label="Account ID" required hint="32 hex characters, on your Cloudflare account home page">
              <Input
                name="accountId"
                defaultValue={text("accountId")}
                placeholder="0123456789abcdef0123456789abcdef"
                required
              />
            </FormField>
            <p className="text-sm text-zinc-600">
              Cloudflare has no delivery webhook, so emails stay at Sent: no Delivered status, and
              bounces and spam complaints after sending are not tracked. Addresses Cloudflare refuses
              outright are still marked Bounced and suppressed.
            </p>
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

        {workspaces && workspaces.length > 0 && (
          <WorkspaceChoices
            workspaces={workspaces}
            providerId={provider?.id}
            ticked={ticked}
            onToggle={toggleWorkspace}
            disabled={isSubmitting}
          />
        )}

        <FormErrorBanner error={error} />

        {savedWarning ? (
          <>
            <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Saved, but the credentials could not be confirmed</p>
              <p className="mt-1 text-amber-800">{savedWarning}</p>
              <p className="mt-1 text-amber-800">Send a test email from the editor to be sure they work.</p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button type="button" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        ) : (
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Checking and saving..." : isEdit ? "Save Changes" : "Create Provider"}
            </Button>
          </div>
        )}
      </form>
    </Dialog>
  );
}

function WorkspaceChoices({
  workspaces,
  providerId,
  ticked,
  onToggle,
  disabled,
}: {
  workspaces: ProviderWorkspaceChoice[];
  providerId: number | undefined;
  ticked: number[];
  onToggle: (id: number) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="space-y-2 pt-2">
      <legend className="text-sm font-medium text-zinc-900">Use in workspaces</legend>
      <p className="text-xs text-zinc-500">
        Ticked workspaces send through this provider. A workspace uses one provider at a time.
      </p>
      <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200 divide-y divide-zinc-100">
        {workspaces.map((w) => {
          const other = w.providerId !== null && w.providerId !== providerId;
          return (
            <label key={w.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-zinc-50">
              <input
                type="checkbox"
                className="rounded border-zinc-300"
                checked={ticked.includes(w.id)}
                onChange={() => onToggle(w.id)}
                disabled={disabled}
              />
              <span className="flex-1 truncate text-zinc-800">{w.name}</span>
              {other && (
                <span className="text-xs text-zinc-400 truncate">
                  {ticked.includes(w.id) ? "replaces " : "currently: "}
                  {w.providerName ?? "another provider"}
                </span>
              )}
              {w.providerId === null && !ticked.includes(w.id) && (
                <span className="text-xs text-amber-600">sending disabled</span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
