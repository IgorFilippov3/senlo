// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { AccessGuard, listInScope, type AccessAction } from "../access";
import { ServiceHooks } from "../hooks";
import type { EmailProvider, EmailProviderType, PublicEmailProvider } from "../domain";
import { FormValidationError, NotFoundError } from "../errors";
import { parseInput } from "../validation";
import type { IEmailProviderRepository } from "../ports";

export const EMAIL_PROVIDER_TYPES = [
  "RESEND",
  "MAILGUN",
  "SES",
  "POSTMARK",
  "SMTP",
] as const satisfies readonly EmailProviderType[];

/**
 * Everything a provider form can send. Which fields matter depends on
 * `type`; `buildProviderConfig` enforces that per type.
 */
export const EmailProviderInputSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  type: z.enum(EMAIL_PROVIDER_TYPES),
  apiKey: z.string().trim().optional(),
  webhookSecret: z.string().trim().optional(),
  domain: z.string().trim().optional(),
  region: z.string().trim().optional(),
  accessKeyId: z.string().trim().optional(),
  secretAccessKey: z.string().trim().optional(),
  serverToken: z.string().trim().optional(),
  host: z.string().trim().optional(),
  // An empty field (a form for another type, or a cleared input) is "not set".
  port: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int().min(1).max(65535).optional(),
  ),
  encryption: z.enum(["ssl", "starttls", "none"]).optional(),
  username: z.string().trim().optional(),
  // Not trimmed: leading or trailing whitespace can be part of a password.
  password: z.string().optional(),
});

export const EmailProviderUpdateSchema = EmailProviderInputSchema.partial().extend({
  /** A checkbox: the stored webhook secret is never sent to the form, so clearing it is explicit. */
  clearWebhookSecret: z.preprocess(
    (v) => v === true || v === "on" || v === "true",
    z.boolean(),
  ).optional(),
});

export type EmailProviderInput = z.infer<typeof EmailProviderInputSchema>;
export type EmailProviderUpdate = z.infer<typeof EmailProviderUpdateSchema>;

export type EmailProviderField = keyof EmailProviderUpdate | "general";

/** Config keys that hold credentials: stored, used to send, never sent to a browser. */
export const EMAIL_PROVIDER_SECRET_KEYS = [
  "apiKey",
  "webhook_secret",
  "secretAccessKey",
  "serverToken",
  "password",
] as const;

/** The provider without its credentials, for anything a browser receives. */
export function toPublicEmailProvider(provider: EmailProvider): PublicEmailProvider {
  const config: Record<string, string | number> = {};
  const secretsSet: string[] = [];
  for (const [key, value] of Object.entries(provider.config ?? {})) {
    if ((EMAIL_PROVIDER_SECRET_KEYS as readonly string[]).includes(key)) {
      if (value) secretsSet.push(key);
    } else if (typeof value === "string" || typeof value === "number") {
      config[key] = value;
    }
  }
  return { ...provider, config, secretsSet };
}
export type EmailProviderFieldErrors = Partial<Record<EmailProviderField, string[]>>;

export type ProviderConfig = Record<string, string | number>;

type ConfigOutcome =
  | { config: ProviderConfig }
  | { fieldErrors: EmailProviderFieldErrors };

function missing(fields: Partial<Record<EmailProviderField, string>>): ConfigOutcome {
  const fieldErrors: EmailProviderFieldErrors = {};
  for (const [field, message] of Object.entries(fields)) {
    if (message) fieldErrors[field as EmailProviderField] = [message];
  }
  return { fieldErrors };
}

/** The stored config for a new provider, or which fields the type needs. */
export function buildProviderConfig(input: EmailProviderInput): ConfigOutcome {
  switch (input.type) {
    case "RESEND":
      if (!input.apiKey) return missing({ apiKey: "Resend API key is required" });
      return { config: { apiKey: input.apiKey, webhook_secret: input.webhookSecret || "" } };

    case "MAILGUN":
      if (!input.apiKey || !input.domain) {
        return missing({
          apiKey: input.apiKey ? undefined : "Mailgun API key is required",
          domain: input.domain ? undefined : "Mailgun domain is required",
        });
      }
      return {
        config: { apiKey: input.apiKey, domain: input.domain, region: input.region || "US" },
      };

    case "SES":
      if (!input.accessKeyId || !input.secretAccessKey || !input.region) {
        return missing({
          accessKeyId: input.accessKeyId ? undefined : "Access Key ID is required",
          secretAccessKey: input.secretAccessKey ? undefined : "Secret Access Key is required",
          region: input.region ? undefined : "Region is required",
        });
      }
      return {
        config: {
          accessKeyId: input.accessKeyId,
          secretAccessKey: input.secretAccessKey,
          region: input.region,
        },
      };

    case "POSTMARK":
      if (!input.serverToken) {
        return missing({ serverToken: "Postmark server token is required" });
      }
      return {
        config: { serverToken: input.serverToken, webhook_secret: input.webhookSecret || "" },
      };

    case "SMTP": {
      if (!input.host || !input.port) {
        return missing({
          host: input.host ? undefined : "SMTP host is required",
          port: input.port ? undefined : "SMTP port is required",
        });
      }
      // Username and password are both optional: an internal relay on a
      // private network commonly accepts mail from known hosts
      // unauthenticated. A username without a password is a mistake worth
      // catching, though.
      if (input.username && !input.password) {
        return missing({ password: "Password is required when a username is set" });
      }
      return {
        config: {
          host: input.host,
          port: input.port,
          encryption: input.encryption || "starttls",
          username: input.username || "",
          password: input.password || "",
        },
      };
    }
  }
}

function applyWebhookSecret(config: ProviderConfig, input: EmailProviderUpdate) {
  if (input.clearWebhookSecret) config.webhook_secret = "";
  else if (input.webhookSecret) config.webhook_secret = input.webhookSecret;
}

/**
 * Applies an edit to a stored config. Only the fields the (new or current)
 * type uses are touched; an empty secret means "keep the stored one", so
 * editing the host does not silently wipe a credential. The form never sees
 * stored secrets, so removing the webhook secret takes `clearWebhookSecret`.
 */
export function mergeProviderConfig(
  provider: EmailProvider,
  input: EmailProviderUpdate,
): ProviderConfig {
  const config: ProviderConfig = { ...provider.config };
  const type = input.type ?? provider.type;

  switch (type) {
    case "RESEND":
      if (input.apiKey) config.apiKey = input.apiKey;
      applyWebhookSecret(config, input);
      break;
    case "MAILGUN":
      if (input.apiKey) config.apiKey = input.apiKey;
      if (input.domain) config.domain = input.domain;
      if (input.region) config.region = input.region;
      break;
    case "SES":
      if (input.accessKeyId) config.accessKeyId = input.accessKeyId;
      if (input.secretAccessKey) config.secretAccessKey = input.secretAccessKey;
      if (input.region) config.region = input.region;
      break;
    case "POSTMARK":
      if (input.serverToken) config.serverToken = input.serverToken;
      applyWebhookSecret(config, input);
      break;
    case "SMTP":
      if (input.host) config.host = input.host;
      if (input.port) config.port = input.port;
      if (input.encryption) config.encryption = input.encryption;
      if (input.username !== undefined) config.username = input.username;
      if (input.password) config.password = input.password;
      break;
  }
  return config;
}

/**
 * A provider whose stored config cannot be decrypted has nothing to keep, so
 * an edit has to supply every field its type needs, as a new provider would.
 */
function replaceUnreadableConfig(provider: EmailProvider, input: EmailProviderUpdate): ProviderConfig {
  const outcome = buildProviderConfig({
    ...input,
    name: input.name || provider.name,
    type: input.type ?? provider.type,
  });
  if ("fieldErrors" in outcome) throw new FormValidationError(outcome.fieldErrors);
  return outcome.config;
}

/**
 * A user's sending providers: create and edit with per-type rules, and the
 * ownership check every other feature needs before it uses a provider.
 * Everything a UI receives is the public view; only `requireOwned` returns
 * credentials, for server-side use.
 */
export class EmailProviderService {
  constructor(
    private readonly providers: IEmailProviderRepository,
    private readonly access: Pick<AccessGuard, "requireOwned" | "requireCreate" | "scopeFor"> = AccessGuard.forOwnedRecords(),
    private readonly hooks: ServiceHooks = ServiceHooks.none,
  ) {}

  /** The providers in the user's scope (their own, or their organization's). */
  async listForUser(userId: string): Promise<PublicEmailProvider[]> {
    return (await listInScope(await this.access.scopeFor(userId), this.providers)).map(toPublicEmailProvider);
  }

  /** The provider, if the user may access it; "not found" otherwise, so ids leak nothing. */
  async requireOwned(userId: string, id: number, action: AccessAction): Promise<EmailProvider> {
    return this.access.requireOwned(userId, await this.providers.findById(id), "Provider", action);
  }

  /** Raw form fields in; the schema and the per-type rules decide. */
  async create(userId: string, rawInput: unknown): Promise<PublicEmailProvider> {
    const input = parseInput(EmailProviderInputSchema, rawInput);
    const outcome = buildProviderConfig(input);
    if ("fieldErrors" in outcome) {
      throw new FormValidationError(outcome.fieldErrors);
    }
    const scope = await this.access.requireCreate(userId, "Provider");
    const created = await this.providers.create({
      name: input.name,
      type: input.type,
      config: outcome.config,
      isActive: true,
      userId,
      organizationId: scope.organizationId,
    });
    await this.audit(userId, "created", created.id, { type: created.type });
    return toPublicEmailProvider(created);
  }

  async update(userId: string, id: number, rawInput: unknown): Promise<PublicEmailProvider> {
    const provider = await this.requireOwned(userId, id, "write");
    const input = parseInput(EmailProviderUpdateSchema, rawInput);
    const updated = await this.providers.update(id, {
      name: input.name || provider.name,
      type: input.type || provider.type,
      config: provider.configUnreadable
        ? replaceUnreadableConfig(provider, input)
        : mergeProviderConfig(provider, input),
    });
    if (!updated) throw new NotFoundError("Provider");
    await this.audit(userId, "updated", id);
    return toPublicEmailProvider(updated);
  }

  async setActive(userId: string, id: number, isActive: boolean): Promise<PublicEmailProvider> {
    await this.requireOwned(userId, id, "write");
    const updated = await this.providers.update(id, { isActive });
    if (!updated) throw new NotFoundError("Provider");
    await this.audit(userId, isActive ? "activated" : "deactivated", id);
    return toPublicEmailProvider(updated);
  }

  async delete(userId: string, id: number): Promise<void> {
    await this.requireOwned(userId, id, "write");
    await this.providers.delete(id);
    await this.audit(userId, "deleted", id);
  }

  private audit(userId: string, verb: string, id: number, details?: Record<string, unknown>) {
    return this.hooks.audit({
      actor: { userId },
      action: `email_provider.${verb}`,
      target: { type: "email_provider", id },
      details,
    });
  }
}
