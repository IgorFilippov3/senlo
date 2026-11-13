import { describe, it, expect, beforeEach } from "vitest";
import {
  EmailProviderService,
  buildProviderConfig,
  mergeProviderConfig,
  toPublicEmailProvider,
} from "../services/emailProviderService";
import { FormValidationError, NotFoundError } from "../errors";
import type { EmailProvider } from "../domain";

function provider(over: Partial<EmailProvider> = {}): EmailProvider {
  return {
    id: 1, userId: "alice", name: "Main", type: "RESEND", isActive: true,
    config: { apiKey: "re_1", webhook_secret: "w" }, createdAt: new Date(), updatedAt: new Date(),
    ...over,
  };
}

function fakeRepo(seed: EmailProvider[] = []) {
  const rows = new Map(seed.map((p) => [p.id, p]));
  let nextId = 100;
  return {
    rows,
    findById: async (id: number) => rows.get(id) ?? null,
    findAll: async () => [...rows.values()],
    listForUser: async (userId: string) => [...rows.values()].filter((p) => p.userId === userId),
    listForOrganization: async (o: string) => [...rows.values()].filter((p) => p.organizationId === o),
    create: async (data: Omit<EmailProvider, "id" | "createdAt" | "updatedAt">) => {
      const p = { ...data, id: nextId++, createdAt: new Date(), updatedAt: new Date() };
      rows.set(p.id, p);
      return p;
    },
    update: async (id: number, data: Partial<EmailProvider>) => {
      const p = rows.get(id);
      if (!p) return null;
      const u = { ...p, ...data };
      rows.set(id, u);
      return u;
    },
    delete: async (id: number) => { rows.delete(id); },
  };
}

const fieldErrorsOf = async (p: Promise<unknown>) => {
  const e = await p.catch((err) => err);
  expect(e).toBeInstanceOf(FormValidationError);
  return (e as FormValidationError).fieldErrors;
};

describe("buildProviderConfig", () => {
  it("requires what each type needs", () => {
    expect(buildProviderConfig({ name: "x", type: "RESEND" })).toEqual({
      fieldErrors: { apiKey: ["Resend API key is required"] },
    });
    expect(buildProviderConfig({ name: "x", type: "MAILGUN", apiKey: "k" })).toEqual({
      fieldErrors: { domain: ["Mailgun domain is required"] },
    });
    expect(buildProviderConfig({ name: "x", type: "SES", region: "eu-west-1" })).toEqual({
      fieldErrors: {
        accessKeyId: ["Access Key ID is required"],
        secretAccessKey: ["Secret Access Key is required"],
      },
    });
    expect(buildProviderConfig({ name: "x", type: "POSTMARK" })).toEqual({
      fieldErrors: { serverToken: ["Postmark server token is required"] },
    });
    expect(buildProviderConfig({ name: "x", type: "SMTP", host: "h" })).toEqual({
      fieldErrors: { port: ["SMTP port is required"] },
    });
  });

  it("fills defaults", () => {
    expect(buildProviderConfig({ name: "x", type: "MAILGUN", apiKey: "k", domain: "d" })).toEqual({
      config: { apiKey: "k", domain: "d", region: "US" },
    });
    expect(buildProviderConfig({ name: "x", type: "RESEND", apiKey: "k" })).toEqual({
      config: { apiKey: "k", webhook_secret: "" },
    });
    expect(buildProviderConfig({ name: "x", type: "SMTP", host: "h", port: 25 })).toEqual({
      config: { host: "h", port: 25, encryption: "starttls", username: "", password: "" },
    });
  });

  it("builds and merges a SendGrid config", () => {
    expect(buildProviderConfig({ name: "x", type: "SENDGRID" })).toEqual({
      fieldErrors: { apiKey: ["SendGrid API key is required"] },
    });
    expect(buildProviderConfig({ name: "x", type: "SENDGRID", apiKey: "SG.k" })).toEqual({
      config: { apiKey: "SG.k", region: "US", webhook_secret: "" },
    });
    expect(
      buildProviderConfig({ name: "x", type: "SENDGRID", apiKey: "SG.k", region: "EU", webhookSecret: "pk" }),
    ).toEqual({ config: { apiKey: "SG.k", region: "EU", webhook_secret: "pk" } });
    const sg = provider({ type: "SENDGRID", config: { apiKey: "SG.k", region: "US", webhook_secret: "pk" } });
    expect(mergeProviderConfig(sg, { apiKey: "", region: "EU", webhookSecret: "" })).toEqual({
      apiKey: "SG.k", region: "EU", webhook_secret: "pk",
    });
  });

  it("builds and merges a Mailjet config, refusing an unknown region", () => {
    expect(buildProviderConfig({ name: "x", type: "MAILJET", apiKey: "k" })).toEqual({
      fieldErrors: { apiSecret: ["Mailjet secret key is required"] },
    });
    expect(buildProviderConfig({ name: "x", type: "MAILJET", apiKey: "k", apiSecret: "s" })).toEqual({
      config: { apiKey: "k", apiSecret: "s", region: "GLOBAL", webhook_secret: "" },
    });
    expect(buildProviderConfig({ name: "x", type: "MAILJET", apiKey: "k", apiSecret: "s", region: "ASIA" })).toEqual({
      fieldErrors: { region: ["Region must be GLOBAL or US"] },
    });
    const mj = provider({ type: "MAILJET", config: { apiKey: "k", apiSecret: "s", region: "GLOBAL", webhook_secret: "w" } });
    expect(mergeProviderConfig(mj, { apiKey: "", apiSecret: "", region: "US" })).toEqual({
      apiKey: "k", apiSecret: "s", region: "US", webhook_secret: "w",
    });
    expect(() => mergeProviderConfig(mj, { region: "ASIA" })).toThrow(FormValidationError);
    // The secret goes into the webhook URL, so it has to be URL-safe.
    expect(
      buildProviderConfig({ name: "x", type: "MAILJET", apiKey: "k", apiSecret: "s", webhookSecret: "a@b:c/d" }),
    ).toEqual({
      fieldErrors: { webhookSecret: ["Use letters, digits, - and _ only: the secret goes into the webhook URL"] },
    });
    expect(
      buildProviderConfig({ name: "x", type: "MAILJET", apiKey: "k", apiSecret: "s", webhookSecret: "Ab-9_x" }),
    ).toMatchObject({ config: { webhook_secret: "Ab-9_x" } });
    expect(() => mergeProviderConfig(mj, { webhookSecret: "bad#secret" })).toThrow(FormValidationError);
    expect(mergeProviderConfig(mj, { webhookSecret: "good_secret" }).webhook_secret).toBe("good_secret");
    expect(toPublicEmailProvider(mj).secretsSet).toEqual(["apiKey", "apiSecret", "webhook_secret"]);
  });

  it("builds and merges a Cloudflare config, checking the account id", () => {
    const acct = "0123456789abcdef0123456789abcdef";
    expect(buildProviderConfig({ name: "x", type: "CLOUDFLARE", apiKey: "t" })).toEqual({
      fieldErrors: { accountId: ["Cloudflare account ID is required"] },
    });
    expect(buildProviderConfig({ name: "x", type: "CLOUDFLARE", apiKey: "t", accountId: "acme" })).toMatchObject({
      fieldErrors: { accountId: [expect.stringContaining("32 hex characters")] },
    });
    expect(buildProviderConfig({ name: "x", type: "CLOUDFLARE", apiKey: "t", accountId: acct })).toEqual({
      config: { accountId: acct, apiKey: "t" },
    });
    const cf = provider({ type: "CLOUDFLARE", config: { accountId: acct, apiKey: "t" } });
    expect(mergeProviderConfig(cf, { apiKey: "" })).toEqual({ accountId: acct, apiKey: "t" });
    expect(() => mergeProviderConfig(cf, { accountId: "../x" })).toThrow(FormValidationError);
    expect(toPublicEmailProvider(cf)).toMatchObject({ config: { accountId: acct }, secretsSet: ["apiKey"] });
  });

  it("allows an unauthenticated SMTP relay but not a username without a password", () => {
    expect(buildProviderConfig({ name: "x", type: "SMTP", host: "h", port: 25, username: "u" })).toEqual({
      fieldErrors: { password: ["Password is required when a username is set"] },
    });
  });
});

describe("mergeProviderConfig", () => {
  it("keeps a stored secret when the field is left empty", () => {
    const p = provider({ type: "SMTP", config: { host: "h", port: 25, password: "old", username: "u" } });
    expect(mergeProviderConfig(p, { host: "h2", password: "" })).toEqual({
      host: "h2", port: 25, password: "old", username: "u",
    });
    const r = provider();
    expect(mergeProviderConfig(r, { apiKey: "" })).toEqual({ apiKey: "re_1", webhook_secret: "w" });
  });

  it("keeps the webhook secret on an empty field and clears it only on request", () => {
    expect(mergeProviderConfig(provider(), { webhookSecret: "" })).toEqual({ apiKey: "re_1", webhook_secret: "w" });
    expect(mergeProviderConfig(provider(), { clearWebhookSecret: true })).toEqual({ apiKey: "re_1", webhook_secret: "" });
    expect(mergeProviderConfig(provider(), { clearWebhookSecret: true, webhookSecret: "w2" })).toEqual({ apiKey: "re_1", webhook_secret: "" });
  });
});

describe("toPublicEmailProvider", () => {
  it("drops every credential and says which ones are set", () => {
    const smtp = provider({
      type: "SMTP",
      config: { host: "h", port: 587, encryption: "starttls", username: "u", password: "p" },
    });
    expect(toPublicEmailProvider(smtp)).toMatchObject({
      config: { host: "h", port: 587, encryption: "starttls", username: "u" },
      secretsSet: ["password"],
    });
    const ses = provider({ type: "SES", config: { accessKeyId: "AKIA", secretAccessKey: "s", region: "eu" } });
    expect(toPublicEmailProvider(ses).config).toEqual({ accessKeyId: "AKIA", region: "eu" });
    const resend = toPublicEmailProvider(provider({ config: { apiKey: "re_1", webhook_secret: "" } }));
    expect(resend.config).toEqual({});
    expect(resend.secretsSet).toEqual(["apiKey"]);
  });

  it("uses the new type's fields when the type changes", () => {
    const merged = mergeProviderConfig(provider(), { type: "POSTMARK", serverToken: "t", apiKey: "ignored" });
    expect(merged).toEqual({ apiKey: "re_1", webhook_secret: "w", serverToken: "t" });
  });
});

describe("SES config", () => {
  const TOPIC = "arn:aws:sns:eu-west-1:123456789012:senlo-events";
  const base = { name: "ses", type: "SES" as const, accessKeyId: "AKIA", secretAccessKey: "s", region: "eu-west-1" };
  const ses = (config: Record<string, string>) =>
    provider({ type: "SES", config: { accessKeyId: "AKIA", secretAccessKey: "s", region: "eu-west-1", ...config } });

  it("stores the configuration set and the topic ARN as the webhook secret", () => {
    expect(buildProviderConfig({ ...base, configurationSet: "senlo-events", webhookSecret: TOPIC })).toEqual({
      config: {
        accessKeyId: "AKIA",
        secretAccessKey: "s",
        region: "eu-west-1",
        configurationSet: "senlo-events",
        webhook_secret: TOPIC,
      },
    });
    expect(buildProviderConfig(base)).toEqual({
      config: { accessKeyId: "AKIA", secretAccessKey: "s", region: "eu-west-1", configurationSet: "", webhook_secret: "" },
    });
  });

  it("accepts topic ARNs of the China and GovCloud partitions", () => {
    for (const arn of ["arn:aws-cn:sns:cn-north-1:123456789012:t", "arn:aws-us-gov:sns:us-gov-west-1:123456789012:t"]) {
      expect(buildProviderConfig({ ...base, webhookSecret: arn })).toHaveProperty("config");
    }
  });

  it("refuses a malformed region, configuration set or topic ARN", () => {
    expect(
      buildProviderConfig({ ...base, region: "Ireland", configurationSet: "my set", webhookSecret: "senlo-events" }),
    ).toEqual({
      fieldErrors: {
        region: ["Use the AWS region code, e.g. eu-west-1"],
        configurationSet: ["Configuration set names use letters, digits, - and _ only (up to 64)"],
        webhookSecret: ["Enter the SNS topic ARN: arn:aws:sns:<region>:<account id>:<topic name>"],
      },
    });
    for (const arn of ["arn:aws:sqs:eu-west-1:123456789012:q", "arn:aws:sns:eu-west-1:1234:t", "arn:aws:sns:eu-west-1:123456789012:t.fifo"]) {
      expect(buildProviderConfig({ ...base, webhookSecret: arn })).toHaveProperty("fieldErrors.webhookSecret");
    }
  });

  it("on edit: keeps secrets left empty, clears the configuration set when emptied, sets and clears the topic", () => {
    const stored = ses({ configurationSet: "old", webhook_secret: TOPIC });
    expect(mergeProviderConfig(stored, { accessKeyId: "", secretAccessKey: "" })).toMatchObject({
      accessKeyId: "AKIA",
      secretAccessKey: "s",
      configurationSet: "old",
      webhook_secret: TOPIC,
    });
    expect(mergeProviderConfig(stored, { configurationSet: "" }).configurationSet).toBe("");
    const other = "arn:aws:sns:eu-west-1:123456789012:other";
    expect(mergeProviderConfig(stored, { webhookSecret: other }).webhook_secret).toBe(other);
    expect(mergeProviderConfig(stored, { clearWebhookSecret: true, webhookSecret: "ignored" }).webhook_secret).toBe("");
  });

  it("on edit: refuses a malformed topic ARN", () => {
    const e = (() => {
      try {
        mergeProviderConfig(ses({}), { webhookSecret: "not-an-arn" });
      } catch (err) {
        return err;
      }
    })();
    expect(e).toBeInstanceOf(FormValidationError);
    expect((e as FormValidationError).fieldErrors).toHaveProperty("webhookSecret");
  });

  it("keeps the topic ARN out of what the browser sees, like other secrets", () => {
    const pub = toPublicEmailProvider(ses({ configurationSet: "set", webhook_secret: TOPIC }));
    expect(pub.config).toEqual({ accessKeyId: "AKIA", region: "eu-west-1", configurationSet: "set" });
    expect(pub.secretsSet).toContain("webhook_secret");
  });
});

describe("EmailProviderService", () => {
  let repo: ReturnType<typeof fakeRepo>;
  let service: EmailProviderService;
  beforeEach(() => {
    repo = fakeRepo([provider(), provider({ id: 2, userId: "bob" })]);
    service = new EmailProviderService(repo);
  });

  it("lists only the user's providers", async () => {
    expect((await service.listForUser("alice")).map((p) => p.id)).toEqual([1]);
  });

  it("creates from raw form fields", async () => {
    const p = await service.create("alice", { name: " New ", type: "POSTMARK", serverToken: "t", port: "" });
    expect(p).toMatchObject({ name: "New", type: "POSTMARK", userId: "alice", isActive: true, config: {}, secretsSet: ["serverToken"] });
    expect(repo.rows.get(p.id)!.config).toEqual({ serverToken: "t", webhook_secret: "" });
  });

  it("reports schema errors as field errors", async () => {
    const errors = await fieldErrorsOf(service.create("alice", { name: "", type: "NOPE" }));
    expect(errors).toHaveProperty("name");
    expect(errors).toHaveProperty("type");
  });

  it("reports per-type errors as field errors", async () => {
    const errors = await fieldErrorsOf(service.create("alice", { name: "x", type: "RESEND" }));
    expect(errors).toEqual({ apiKey: ["Resend API key is required"] });
  });

  it("refuses another user's provider on update and delete, like a missing one", async () => {
    await expect(service.update("alice", 2, { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.delete("alice", 2)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.delete("alice", 999)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.requireOwned("", 1, "read")).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.rows.has(2)).toBe(true);
  });

  it("updates name, type and config together", async () => {
    const p = await service.update("alice", 1, { name: "Renamed", webhookSecret: "w2", port: "", clearWebhookSecret: "" });
    expect(p).toMatchObject({ name: "Renamed", type: "RESEND", secretsSet: ["apiKey", "webhook_secret"] });
    expect(JSON.stringify(p)).not.toContain("re_1");
    expect(repo.rows.get(1)!.config).toEqual({ apiKey: "re_1", webhook_secret: "w2" });
  });

  it("deletes the user's own provider", async () => {
    await service.delete("alice", 1);
    expect(repo.rows.has(1)).toBe(false);
  });
});
