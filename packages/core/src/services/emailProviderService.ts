// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import type { EmailProvider, EmailProviderType } from "../domain";
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

export const EmailProviderUpdateSchema = EmailProviderInputSchema.partial();

export type EmailProviderInput = z.infer<typeof EmailProviderInputSchema>;
export type EmailProviderUpdate = z.infer<typeof EmailProviderUpdateSchema>;

export type EmailProviderField = keyof EmailProviderInput | "general";
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

/**
 * Applies an edit to a stored config. Only the fields the (new or current)
 * type uses are touched; an empty secret means "keep the stored one", so
 * editing the host does not silently wipe a credential.
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
      if (input.webhookSecret !== undefined) config.webhook_secret = input.webhookSecret;
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
      if (input.webhookSecret !== undefined) config.webhook_secret = input.webhookSecret;
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
 * A user's sending providers: create and edit with per-type rules, and the
 * ownership check every other feature needs before it uses a provider.
 */
export class EmailProviderService {
  constructor(private readonly providers: IEmailProviderRepository) {}

  listForUser(userId: string): Promise<EmailProvider[]> {
    return this.providers.findByUser(userId);
  }

  /** The provider, if it is this user's; "not found" otherwise, so ids leak nothing. */
  async requireOwned(userId: string, id: number): Promise<EmailProvider> {
    const provider = await this.providers.findById(id);
    if (!userId || !provider || provider.userId !== userId) {
      throw new NotFoundError("Provider");
    }
    return provider;
  }

  /** Raw form fields in; the schema and the per-type rules decide. */
  async create(userId: string, rawInput: unknown): Promise<EmailProvider> {
    const input = parseInput(EmailProviderInputSchema, rawInput);
    const outcome = buildProviderConfig(input);
    if ("fieldErrors" in outcome) {
      throw new FormValidationError(outcome.fieldErrors);
    }
    return this.providers.create({
      name: input.name,
      type: input.type,
      config: outcome.config,
      isActive: true,
      userId,
    });
  }

  async update(userId: string, id: number, rawInput: unknown): Promise<EmailProvider> {
    const provider = await this.requireOwned(userId, id);
    const input = parseInput(EmailProviderUpdateSchema, rawInput);
    const updated = await this.providers.update(id, {
      name: input.name || provider.name,
      type: input.type || provider.type,
      config: mergeProviderConfig(provider, input),
    });
    if (!updated) throw new NotFoundError("Provider");
    return updated;
  }

  async setActive(userId: string, id: number, isActive: boolean): Promise<EmailProvider> {
    await this.requireOwned(userId, id);
    const updated = await this.providers.update(id, { isActive });
    if (!updated) throw new NotFoundError("Provider");
    return updated;
  }

  async delete(userId: string, id: number): Promise<void> {
    await this.requireOwned(userId, id);
    await this.providers.delete(id);
  }
}
