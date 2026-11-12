// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { AccessGuard, listInScope, type AccessAction } from "../access";
import { ServiceHooks } from "../hooks";
import type { EmailProvider, EmailProviderType, PublicEmailProvider } from "../domain";
import { FormValidationError, NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import { CLOUDFLARE_ACCOUNT_ID } from "./mail/cloudflareMailer";
import type { IEmailProviderRepository, IProjectRepository } from "../ports";

export const EMAIL_PROVIDER_TYPES = [
  "RESEND",
  "MAILGUN",
  "SES",
  "POSTMARK",
  "SENDGRID",
  "MAILJET",
  "CLOUDFLARE",
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
  /** Mailjet's Secret Key, the second half of its API key pair. */
  apiSecret: z.string().trim().optional(),
  webhookSecret: z.string().trim().optional(),
  /** Cloudflare account id; not a secret. */
  accountId: z.string().trim().optional(),
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

/**
 * The workspaces a provider form ticked under "Use in workspaces". Absent:
 * no workspace is touched (API callers, older forms). On edit the list is
 * the whole set: a workspace that used the provider and is not in it stops
 * using it.
 */
export const ProviderWorkspacesSchema = z.object({
  workspaceIds: z.array(z.coerce.number().int().positive()).optional(),
});

/** Deleting a provider: what the workspaces that use it switch to; null or absent leaves them without one. */
export const DeleteProviderSchema = z.object({
  replacementId: z.coerce.number().int().positive().nullish(),
});

export type EmailProviderInput = z.infer<typeof EmailProviderInputSchema>;
export type EmailProviderUpdate = z.infer<typeof EmailProviderUpdateSchema>;

export type EmailProviderField = keyof EmailProviderUpdate | "general";

/** Config keys that hold credentials: stored, used to send, never sent to a browser. */
export const EMAIL_PROVIDER_SECRET_KEYS = [
  "apiKey",
  "apiSecret",
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

/**
 * Mailjet's API hosts: the default one, and the one for accounts on its US
 * infrastructure. An unknown value is refused rather than mapped to the
 * default, which would only fail later, at send time, as an auth error.
 */
const MAILJET_REGIONS: readonly string[] = ["GLOBAL", "US"];

/**
 * Mailjet's webhook secret goes into the callback URL as the basic auth
 * password, so it has to be safe there unencoded: `@ : / ? #` would break
 * the URL, and how Mailjet handles percent-encoding is not documented.
 */
const URL_SAFE_SECRET = /^[A-Za-z0-9_-]+$/;
const MAILJET_SECRET_ERROR = "Use letters, digits, - and _ only: the secret goes into the webhook URL";

const CLOUDFLARE_ACCOUNT_ID_ERROR =
  "Account ID is 32 hex characters (Cloudflare dashboard → Account home → Account ID)";

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

    case "SENDGRID":
      if (!input.apiKey) return missing({ apiKey: "SendGrid API key is required" });
      return {
        config: {
          apiKey: input.apiKey,
          region: input.region === "EU" ? "EU" : "US",
          webhook_secret: input.webhookSecret || "",
        },
      };

    case "MAILJET": {
      if (!input.apiKey || !input.apiSecret) {
        return missing({
          apiKey: input.apiKey ? undefined : "Mailjet API key is required",
          apiSecret: input.apiSecret ? undefined : "Mailjet secret key is required",
        });
      }
      const region = input.region || "GLOBAL";
      if (!MAILJET_REGIONS.includes(region)) {
        return missing({ region: "Region must be GLOBAL or US" });
      }
      if (input.webhookSecret && !URL_SAFE_SECRET.test(input.webhookSecret)) {
        return missing({ webhookSecret: MAILJET_SECRET_ERROR });
      }
      return {
        config: {
          apiKey: input.apiKey,
          apiSecret: input.apiSecret,
          region,
          webhook_secret: input.webhookSecret || "",
        },
      };
    }

    case "CLOUDFLARE":
      if (!input.accountId || !input.apiKey) {
        return missing({
          accountId: input.accountId ? undefined : "Cloudflare account ID is required",
          apiKey: input.apiKey ? undefined : "Cloudflare API token is required",
        });
      }
      if (!CLOUDFLARE_ACCOUNT_ID.test(input.accountId)) {
        return missing({ accountId: CLOUDFLARE_ACCOUNT_ID_ERROR });
      }
      // No webhook secret: Cloudflare has no delivery webhook.
      return { config: { accountId: input.accountId, apiKey: input.apiKey } };

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
    case "SENDGRID":
      if (input.apiKey) config.apiKey = input.apiKey;
      if (input.region) config.region = input.region === "EU" ? "EU" : "US";
      applyWebhookSecret(config, input);
      break;
    case "MAILJET":
      if (input.apiKey) config.apiKey = input.apiKey;
      if (input.apiSecret) config.apiSecret = input.apiSecret;
      if (input.region) {
        if (!MAILJET_REGIONS.includes(input.region)) {
          throw new FormValidationError({ region: ["Region must be GLOBAL or US"] });
        }
        config.region = input.region;
      }
      if (input.webhookSecret && !input.clearWebhookSecret && !URL_SAFE_SECRET.test(input.webhookSecret)) {
        throw new FormValidationError({ webhookSecret: [MAILJET_SECRET_ERROR] });
      }
      applyWebhookSecret(config, input);
      break;
    case "CLOUDFLARE":
      if (input.accountId) {
        if (!CLOUDFLARE_ACCOUNT_ID.test(input.accountId)) {
          throw new FormValidationError({ accountId: [CLOUDFLARE_ACCOUNT_ID_ERROR] });
        }
        config.accountId = input.accountId;
      }
      if (input.apiKey) config.apiKey = input.apiKey;
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
    private readonly access: Pick<
      AccessGuard,
      "requireOwned" | "requireCreate" | "scopeFor" | "requireProject"
    > = AccessGuard.forOwnedRecords(),
    private readonly hooks: ServiceHooks = ServiceHooks.none,
    /** Workspaces a provider is selected for; without it no workspace can be touched. */
    private readonly projects: Pick<
      IProjectRepository,
      "update" | "listForUser" | "listForOrganization"
    > | null = null,
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
    // Checked before anything is stored: a workspace the user cannot change
    // must not leave a new provider behind with the request refused.
    const { workspaceIds } = parseInput(ProviderWorkspacesSchema, rawInput);
    await this.requireWorkspaces(userId, workspaceIds ?? []);
    const created = await this.providers.create({
      name: input.name,
      type: input.type,
      config: outcome.config,
      isActive: true,
      userId,
      organizationId: scope.organizationId,
    });
    await this.audit(userId, "created", created.id, { type: created.type });
    if (workspaceIds?.length) await this.useInWorkspaces(userId, created.id, workspaceIds);
    return toPublicEmailProvider(created);
  }

  async update(userId: string, id: number, rawInput: unknown): Promise<PublicEmailProvider> {
    const provider = await this.requireOwned(userId, id, "write");
    const input = parseInput(EmailProviderUpdateSchema, rawInput);
    const { workspaceIds } = parseInput(ProviderWorkspacesSchema, rawInput);
    await this.requireWorkspaces(userId, workspaceIds ?? []);
    const updated = await this.providers.update(id, {
      name: input.name || provider.name,
      type: input.type || provider.type,
      config: provider.configUnreadable
        ? replaceUnreadableConfig(provider, input)
        : mergeProviderConfig(provider, input),
    });
    if (!updated) throw new NotFoundError("Provider");
    await this.audit(userId, "updated", id);
    if (workspaceIds) {
      // Only what changed: a workspace already on it is not written again.
      const current = await this.workspacesUsing(userId, id);
      await this.useInWorkspaces(userId, id, workspaceIds.filter((w) => !current.includes(w)));
      await this.switchWorkspaces(userId, current.filter((w) => !workspaceIds.includes(w)), null);
    }
    return toPublicEmailProvider(updated);
  }

  async setActive(userId: string, id: number, isActive: boolean): Promise<PublicEmailProvider> {
    await this.requireOwned(userId, id, "write");
    const updated = await this.providers.update(id, { isActive });
    if (!updated) throw new NotFoundError("Provider");
    await this.audit(userId, isActive ? "activated" : "deactivated", id);
    return toPublicEmailProvider(updated);
  }

  /**
   * The workspaces that use it switch to `replacementId` first, if given;
   * otherwise they are left without a provider (the foreign key's `set null`).
   */
  async delete(userId: string, id: number, rawOptions: unknown = {}): Promise<void> {
    await this.requireOwned(userId, id, "write");
    const { replacementId } = parseInput(DeleteProviderSchema, rawOptions);
    if (replacementId) {
      if (replacementId === id) throw new ValidationError("Choose another provider to replace it with");
      await this.requireOwned(userId, replacementId, "read");
      await this.switchWorkspaces(userId, await this.workspacesUsing(userId, id), replacementId);
    }
    await this.providers.delete(id);
    await this.audit(userId, "deleted", id, replacementId ? { replacementId } : undefined);
  }

  /** Selects the provider for each workspace (the user must be able to change it). */
  private async useInWorkspaces(userId: string, providerId: number, workspaceIds: number[]): Promise<void> {
    await this.switchWorkspaces(userId, [...new Set(workspaceIds)], providerId);
  }

  /** Ids of the workspaces in the user's scope that use the provider. */
  private async workspacesUsing(userId: string, providerId: number): Promise<number[]> {
    const workspaces = await listInScope(await this.access.scopeFor(userId), this.requireProjects());
    return workspaces.filter((w) => w.providerId === providerId).map((w) => w.id);
  }

  /**
   * Linking needs write on the workspace and only read on the provider, as
   * in workspace settings. One update per workspace, not one transaction: a
   * failure halfway leaves some switched, which the next save repeats.
   */
  private async switchWorkspaces(userId: string, workspaceIds: number[], providerId: number | null): Promise<void> {
    const projects = this.requireProjects();
    await this.requireWorkspaces(userId, workspaceIds);
    for (const workspaceId of workspaceIds) {
      await projects.update(workspaceId, { providerId });
      await this.hooks.audit({
        actor: { userId },
        action: "project.updated",
        target: { type: "project", id: workspaceId, projectId: workspaceId },
        details: { providerId },
      });
    }
  }

  private async requireWorkspaces(userId: string, workspaceIds: number[]): Promise<void> {
    for (const workspaceId of workspaceIds) {
      await this.access.requireProject(userId, workspaceId, "write");
    }
  }

  private requireProjects() {
    if (!this.projects) throw new Error("EmailProviderService was built without the projects repository");
    return this.projects;
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
