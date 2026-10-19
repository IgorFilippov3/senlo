import { describe, it, expect, beforeEach } from "vitest";
import {
  EmailProviderService,
  buildProviderConfig,
  mergeProviderConfig,
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
    findByUser: async (userId: string) => [...rows.values()].filter((p) => p.userId === userId),
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

  it("lets a webhook secret be cleared explicitly", () => {
    expect(mergeProviderConfig(provider(), { webhookSecret: "" })).toEqual({ apiKey: "re_1", webhook_secret: "" });
  });

  it("uses the new type's fields when the type changes", () => {
    const merged = mergeProviderConfig(provider(), { type: "POSTMARK", serverToken: "t", apiKey: "ignored" });
    expect(merged).toEqual({ apiKey: "re_1", webhook_secret: "w", serverToken: "t" });
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
    expect(p).toMatchObject({ name: "New", type: "POSTMARK", userId: "alice", isActive: true, config: { serverToken: "t", webhook_secret: "" } });
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

  it("refuses another user's provider on update, toggle and delete, like a missing one", async () => {
    await expect(service.update("alice", 2, { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.setActive("alice", 2, false)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.delete("alice", 2)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.delete("alice", 999)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.requireOwned("", 1)).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.rows.has(2)).toBe(true);
  });

  it("updates name, type and config together", async () => {
    const p = await service.update("alice", 1, { name: "Renamed", webhookSecret: "w2", port: "" });
    expect(p).toMatchObject({ name: "Renamed", type: "RESEND", config: { apiKey: "re_1", webhook_secret: "w2" } });
  });

  it("toggles and deletes the user's own provider", async () => {
    expect((await service.setActive("alice", 1, false)).isActive).toBe(false);
    await service.delete("alice", 1);
    expect(repo.rows.has(1)).toBe(false);
  });
});
