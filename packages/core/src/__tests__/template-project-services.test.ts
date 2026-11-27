import { describe, it, expect, vi } from "vitest";
import { TemplateService, TEST_SEND_TIMEOUT_MS, mergeTagsFromVariables } from "../services/emailTemplateService";
import { SavedRowService } from "../services/savedRowService";
import { ProjectService } from "../services/projectService";
import { SettingsService } from "../services/settingsService";
import { EMPTY_EMAIL_DESIGN } from "../constants";
import { ServiceHooks } from "../hooks";
import { FormValidationError, NotFoundError, ProviderError, ValidationError } from "../errors";
import type { ApiKey, Campaign, EmailProvider, Project, SavedRow } from "../domain";
import type { EmailDesignDocument } from "../emailDesign";
import type { EmailTemplate, EmailTemplateVersion, NewEmailTemplateVersion } from "../emailTemplate";
import type { SendMailResult } from "../ports";

const p1 = { id: 1, userId: "alice", name: "Alpha", providerId: 5, aiProviderId: null, createdAt: new Date(), updatedAt: new Date() } as Project;
const p2 = { id: 2, userId: "bob", name: "Beta", providerId: 6, aiProviderId: null, createdAt: new Date(), updatedAt: new Date() } as Project;
const p3 = { id: 3, userId: "alice", name: "NoProvider", providerId: null, aiProviderId: null, createdAt: new Date(), updatedAt: new Date() } as Project;
const projectsRepo = () => {
  const rows = new Map([p1, p2, p3].map((p) => [p.id, p]));
  return {
    rows,
    findById: async (id: number) => rows.get(id) ?? null,
    listForUser: async (u: string) => [...rows.values()].filter((p) => p.userId === u),
    listForOrganization: async (o: string) => [...rows.values()].filter((p) => p.organizationId === o),
    findAll: async () => [...rows.values()],
    create: async (d: { name: string; description?: string | null; userId?: string | null }) => {
      const p = { id: 9, ...d, createdAt: new Date(), updatedAt: new Date() } as Project;
      rows.set(9, p);
      return p;
    },
    update: async (id: number, d: Partial<Project>) => {
      if (!rows.has(id)) return null;
      const u = { ...rows.get(id)!, ...d };
      rows.set(id, u);
      return u;
    },
    delete: async (id: number) => { rows.delete(id); },
  };
};

const tpl = (id: number, projectId: number, over: Partial<EmailTemplate> = {}): EmailTemplate =>
  ({ id, projectId, name: `t${id}`, subject: `s${id}`, preheader: null, html: "", designJson: null, locale: "en", status: "DRAFT", createdAt: new Date(), updatedAt: new Date(), ...over }) as EmailTemplate;

/** An in-memory version history, numbered per template like the real one. */
function versionsFake() {
  const rows: EmailTemplateVersion[] = [];
  const ofTemplate = (tid: number) => rows.filter((r) => r.templateId === tid).sort((a, b) => b.version - a.version);
  return {
    rows,
    latest: async (tid: number) => ofTemplate(tid)[0] ?? null,
    append: vi.fn(async (d: NewEmailTemplateVersion) => {
      const v: EmailTemplateVersion = {
        id: rows.length + 1,
        templateId: d.templateId,
        version: ofTemplate(d.templateId).length + 1,
        design: d.design,
        subject: d.subject,
        preheader: d.preheader,
        source: d.source,
        author: d.createdByUserId ? { kind: "user", userId: d.createdByUserId, name: null, email: "a@x.io" } : null,
        createdAt: new Date(),
      };
      rows.push(v);
      return v;
    }),
    listByTemplate: async (tid: number, limit: number) =>
      ofTemplate(tid)
        .slice(0, limit)
        .map(({ design: _design, ...summary }) => summary),
    findById: async (id: number) => rows.find((r) => r.id === id) ?? null,
  };
}

/** A design that is not the empty one a new template starts with. */
const designA = { ...EMPTY_EMAIL_DESIGN, rows: [{ id: "a" }] } as unknown as EmailDesignDocument;
const designB = { ...EMPTY_EMAIL_DESIGN, rows: [{ id: "b" }] } as unknown as EmailDesignDocument;

function templateFakes() {
  const templates = new Map(
    [
      tpl(10, 1),
      tpl(20, 2),
      tpl(11, 1, { designJson: { ...EMPTY_EMAIL_DESIGN, rows: [] } }),
      // Saved before versions existed: real content, no history.
      tpl(12, 3, { designJson: designA, subject: "Old subject", preheader: "Old pre" }),
    ].map((t) => [t.id, t]),
  );
  const campaigns: Campaign[] = [
    { id: 100, projectId: 1, templateId: 10, variablesSchema: { first_name: "x", order_id: 1 } } as unknown as Campaign,
    { id: 200, projectId: 2, templateId: 20 } as unknown as Campaign,
  ];
  const providers: EmailProvider[] = [
    { id: 5, userId: "alice", type: "RESEND", name: "r", config: {}, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 6, userId: "bob", type: "RESEND", name: "r", config: {}, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ];
  const mailer = { send: vi.fn(async (): Promise<SendMailResult> => ({ success: true, messageId: "m-1" })) };
  const mailerFor = vi.fn((_provider: EmailProvider) => mailer);
  const repos = {
    templates: {
      findById: async (id: number) => templates.get(id) ?? null,
      findByProject: async (pid: number) => [...templates.values()].filter((t) => t.projectId === pid),
      create: vi.fn(async (d: any) => ({ ...tpl(99, d.projectId), ...d })),
      update: vi.fn(async (d: any) => (templates.has(d.id) ? { ...templates.get(d.id)!, ...d } : null)),
      delete: vi.fn(async (id: number) => { templates.delete(id); }),
    },
    projects: projectsRepo(),
    campaigns: {
      findById: async (id: number) => campaigns.find((c) => c.id === id) ?? null,
      findByTemplateId: async (tid: number) => campaigns.find((c) => c.templateId === tid) ?? null,
    },
    providers: { findById: async (id: number) => providers.find((p) => p.id === id) ?? null },
    templateVersions: versionsFake(),
  };
  const service = new TemplateService(repos, mailerFor, { appUrl: "https://app.test", defaultFromEmail: "hello@app.test" });
  return { service, repos, mailer, mailerFor, templates };
}

describe("TemplateService", () => {
  it("lists, creates and deletes inside the user's project only", async () => {
    const { service, repos } = templateFakes();
    expect((await service.listProjectTemplates("alice", 1)).map((t) => t.id)).toEqual([10, 11]);
    await expect(service.listProjectTemplates("alice", 2)).rejects.toBeInstanceOf(NotFoundError);

    const created = await service.create("alice", 1, { name: " New ", subject: "Hi", locale: "" });
    expect(repos.templates.create).toHaveBeenCalledWith({
      projectId: 1, name: "New", subject: "Hi", locale: "en", html: "<p>Empty template</p>", designJson: EMPTY_EMAIL_DESIGN,
    });
    expect(created.name).toBe("New");
    const e = await service.create("alice", 1, { name: "", subject: "" }).catch((x) => x);
    expect(e).toBeInstanceOf(FormValidationError);
    expect(Object.keys(e.fieldErrors).sort()).toEqual(["name", "subject"]);

    await expect(service.delete("alice", 1, 20)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.delete("alice", 2, 20)).rejects.toBeInstanceOf(NotFoundError);
    await service.delete("alice", 1, 10);
    expect(repos.templates.delete).toHaveBeenCalledWith(10);
  });

  it("loads editor data with the trigger's variables as merge tags", async () => {
    const { service } = templateFakes();
    const data = await service.loadEditorData("alice", 10);
    expect(data.campaign?.id).toBe(100);
    expect(data.design).toEqual(EMPTY_EMAIL_DESIGN);
    expect(data.mergeTags).toEqual([
      { label: "First Name", value: "{{first_name}}", category: "custom" },
      { label: "Order Id", value: "{{order_id}}", category: "custom" },
    ]);
    // A campaign id from the URL must be in the same project.
    expect((await service.loadEditorData("alice", 10, 200)).campaign).toBeNull();
    expect((await service.loadEditorData("alice", 11)).campaign).toBeNull();
    await expect(service.loadEditorData("alice", 20)).rejects.toBeInstanceOf(NotFoundError);
    expect(mergeTagsFromVariables(null)).toEqual([]);
  });

  it("saves from the editor only for the owner", async () => {
    const { service, repos } = templateFakes();
    await expect(service.saveFromEditor("bob", 10, { design: EMPTY_EMAIL_DESIGN, html: "<p/>" })).rejects.toBeInstanceOf(NotFoundError);
    await service.saveFromEditor("alice", 10, { design: EMPTY_EMAIL_DESIGN, html: "<p/>", metadata: { name: "N", subject: "S", preheader: "P" } });
    expect(repos.templates.update).toHaveBeenCalledWith({ id: 10, designJson: EMPTY_EMAIL_DESIGN, html: "<p/>", name: "N", subject: "S", locale: undefined, preheader: "P" });
  });

  it("keeps a version per save, and none when nothing changed", async () => {
    const { service, repos } = templateFakes();
    const versions = repos.templateVersions;
    const save = (design: EmailDesignDocument, subject: string) =>
      service.saveFromEditor("alice", 10, { design, html: "<p/>", metadata: { name: "N", subject, preheader: null } });

    await save(designA, "S");
    expect(versions.rows).toHaveLength(1);
    expect(versions.rows[0]).toMatchObject({
      templateId: 10,
      version: 1,
      design: designA,
      subject: "S",
      preheader: null,
      source: "editor",
      author: { kind: "user", userId: "alice" },
    });

    // Same content again, keys in another order: not a change.
    const reorder = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(reorder)
        : v && typeof v === "object"
          ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, reorder((v as Record<string, unknown>)[k])]))
          : v;
    await save(reorder(designA) as EmailDesignDocument, "S");
    expect(versions.rows).toHaveLength(1);

    await save(designA, "S2");
    await save(designB, "S2");
    expect(versions.rows.map((v) => [v.version, v.subject])).toEqual([
      [1, "S"],
      [2, "S2"],
      [3, "S2"],
    ]);
  });

  it("writes the version before the template, so a failed save leaves no gap", async () => {
    const { service, repos } = templateFakes();
    repos.templates.update.mockRejectedValueOnce(new Error("db down"));
    const input = { design: designA, html: "<p/>", metadata: { name: "N", subject: "S" } };

    await expect(service.saveFromEditor("alice", 10, input)).rejects.toThrow("db down");
    await service.saveFromEditor("alice", 10, input);
    // The retry is the same content: one version, and the template is saved.
    expect(repos.templateVersions.rows).toHaveLength(1);
    expect(repos.templates.update).toHaveBeenCalledTimes(2);
  });

  it("keeps what a template had before versions as a baseline on its first save", async () => {
    const { service, repos } = templateFakes();
    await service.saveFromEditor("alice", 12, { design: designB, html: "<p/>", metadata: { name: "t", subject: "New" } });

    expect(repos.templateVersions.rows.map((v) => [v.version, v.source, v.subject, v.preheader, v.author])).toEqual([
      [1, "baseline", "Old subject", "Old pre", null],
      [2, "editor", "New", null, expect.objectContaining({ userId: "alice" })],
    ]);
    expect(repos.templateVersions.rows[0].design).toEqual(designA);
  });

  it("adds no baseline for a new template's empty design", async () => {
    const { service, repos } = templateFakes();
    await service.saveFromEditor("alice", 11, { design: designA, html: "<p/>" });
    expect(repos.templateVersions.rows.map((v) => v.source)).toEqual(["editor"]);
    // No metadata: the version keeps the template's own subject.
    expect(repos.templateVersions.rows[0].subject).toBe("s11");
  });

  it("lists and reads versions only for the template's owner, and only of that template", async () => {
    const { service } = templateFakes();
    await service.saveFromEditor("alice", 10, { design: designA, html: "<p/>" });
    await service.saveFromEditor("alice", 10, { design: designB, html: "<p/>" });
    await service.saveFromEditor("alice", 11, { design: designA, html: "<p/>" });

    const list = await service.listVersions("alice", 10);
    expect(list.map((v) => v.version)).toEqual([2, 1]);
    expect(list[0]).not.toHaveProperty("design");
    await expect(service.listVersions("bob", 10)).rejects.toBeInstanceOf(NotFoundError);

    expect((await service.getVersion("alice", 10, list[1].id)).design).toEqual(designA);
    const ofOther = (await service.listVersions("alice", 11))[0];
    await expect(service.getVersion("alice", 10, ofOther.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.getVersion("bob", 10, list[0].id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("sendTest checks addresses, provider presence and ownership, then sends the rendered mail now", async () => {
    const { service, mailer, mailerFor } = templateFakes();
    const design = EMPTY_EMAIL_DESIGN;
    await expect(service.sendTest("alice", 10, { to: "a@b, c@d", design })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.sendTest("alice", 10, { to: "a@b.co", from: "Me <x@y.co>", design })).rejects.toBeInstanceOf(ValidationError);
    // Project 3 has no provider.
    const { service: s3, mailer: m3 } = templateFakes();
    s3["repos"].templates.findById = async () => tpl(30, 3);
    await expect(s3.sendTest("alice", 30, { to: "a@b.co", design })).rejects.toThrow(/No email provider/);
    expect(m3.send).not.toHaveBeenCalled();

    const r = await service.sendTest("alice", 10, { to: "a@b.co", from: "", design, subject: "" });
    expect(r).toEqual({ messageId: "m-1" });
    expect(mailerFor.mock.calls[0][0]).toMatchObject({ id: 5 });
    const sent = (mailer.send.mock.calls[0] as any)[0];
    expect(sent).toMatchObject({ to: "a@b.co", from: "hello@app.test", subject: "[TEST] s10" });
    expect(sent.html).toContain("<");
    expect(typeof sent.text).toBe("string");
  });

  it("sendTest records the send as a test", async () => {
    const { repos } = templateFakes();
    const record = vi.fn(async () => {});
    const mailer = { send: vi.fn(async (): Promise<SendMailResult> => ({ success: true, messageId: "m-1" })) };
    const service = new TemplateService(
      repos,
      () => mailer,
      { appUrl: "https://app.test", defaultFromEmail: "hello@app.test" },
      undefined,
      new ServiceHooks({ usage: { record } }),
    );
    await service.sendTest("alice", 10, { to: "a@b.co", design: EMPTY_EMAIL_DESIGN });
    expect(record).toHaveBeenCalledWith({ type: "email.sent", projectId: 1, campaignId: null, provider: "RESEND", test: true });
  });

  it("sendTest returns the provider's refusal as a ProviderError", async () => {
    const { service, mailer } = templateFakes();
    mailer.send.mockResolvedValueOnce({ success: false, error: "API key is invalid", permanent: true });
    const e = await service.sendTest("alice", 10, { to: "a@b.co", design: EMPTY_EMAIL_DESIGN }).catch((x) => x);
    expect(e).toBeInstanceOf(ProviderError);
    expect(e.message).toContain("API key is invalid");
  });

  it("sendTest gives up waiting after the timeout and says the email may still arrive", async () => {
    vi.useFakeTimers();
    try {
      const { service, mailer } = templateFakes();
      mailer.send.mockReturnValueOnce(new Promise(() => {}));
      const pending = service.sendTest("alice", 10, { to: "a@b.co", design: EMPTY_EMAIL_DESIGN }).catch((x) => x);
      // The timer starts in the same tick as the send: wait for the send, then run the clock.
      for (let i = 0; i < 100 && mailer.send.mock.calls.length === 0; i++) await Promise.resolve();
      expect(mailer.send).toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(TEST_SEND_TIMEOUT_MS + 1);
      const e = await pending;
      expect(e).toBeInstanceOf(ProviderError);
      expect(e.message).toMatch(/may still arrive/);
    } finally {
      vi.useRealTimers();
    }
  });

});

describe("SavedRowService", () => {
  const rows: SavedRow[] = [{ id: 1, userId: "alice", projectId: null, name: "hero", data: {}, createdAt: new Date(), updatedAt: new Date() }];
  const repo = {
    findById: async (id: number) => rows.find((r) => r.id === id) ?? null,
    findByUser: async (u: string) => rows.filter((r) => r.userId === u),
    create: vi.fn(async (d: any) => ({ id: 2, ...d, createdAt: new Date(), updatedAt: new Date() })),
    delete: vi.fn(async () => {}),
  };
  const service = new SavedRowService(repo, projectsRepo());

  it("saves with an optional project the user owns", async () => {
    await expect(service.save("alice", { name: " ", data: {} })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.save("alice", { name: "x", data: {}, projectId: 2 })).rejects.toBeInstanceOf(NotFoundError);
    const r = await service.save("alice", { name: " row ", data: { a: 1 }, projectId: 1 });
    expect(repo.create).toHaveBeenCalledWith({ userId: "alice", projectId: 1, name: "row", data: { a: 1 } });
    expect(r.id).toBe(2);
  });

  it("deletes only the owner's row", async () => {
    await expect(service.delete("bob", 1)).rejects.toBeInstanceOf(NotFoundError);
    await service.delete("alice", 1);
    expect(repo.delete).toHaveBeenCalledWith(1);
  });
});

describe("ProjectService", () => {
  const aiProviders = { findById: async (id: number) => (id === 7 ? { id: 7, userId: "alice" } as any : id === 8 ? { id: 8, userId: "bob" } as any : null) };
  const providers = { findById: async (id: number) => (id === 5 ? { id: 5, userId: "alice" } as any : id === 6 ? { id: 6, userId: "bob" } as any : null) };
  const make = () => new ProjectService({ projects: projectsRepo(), providers, aiProviders });

  it("creates with a trimmed name and null description", async () => {
    const p = await make().create("alice", { name: " New ", description: " " });
    expect(p).toMatchObject({ name: "New", description: null, userId: "alice" });
    const e = await make().create("alice", { name: "" }).catch((x) => x);
    expect(e).toBeInstanceOf(FormValidationError);
    expect(e.fieldErrors.name).toEqual(["Project name is required"]);
  });

  it("updates with provider ownership checks and 'none' as null", async () => {
    const s = make();
    await expect(s.update("alice", 2, { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(s.update("alice", 1, { name: "x", providerId: "6" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(s.update("alice", 1, { name: "x", aiProviderId: "8" })).rejects.toBeInstanceOf(NotFoundError);
    const p = await s.update("alice", 1, { name: "Renamed", description: "", providerId: "none", aiProviderId: "7" });
    expect(p).toMatchObject({ name: "Renamed", description: null, providerId: null, aiProviderId: 7 });
  });

  it("keeps what an update leaves out, and clears only on an explicit empty value", async () => {
    const s = make();
    await s.update("alice", 1, { name: "Linked", description: "About", providerId: "5", aiProviderId: "7" });

    const renamed = await s.update("alice", 1, { name: "Only the name" });
    expect(renamed).toMatchObject({ name: "Only the name", description: "About", providerId: 5, aiProviderId: 7 });

    const unlinked = await s.update("alice", 1, { aiProviderId: null });
    expect(unlinked).toMatchObject({ name: "Only the name", description: "About", providerId: 5, aiProviderId: null });

    const cleared = await s.update("alice", 1, { description: "", providerId: "" });
    expect(cleared).toMatchObject({ description: null, providerId: null });

    const e = await s.update("alice", 1, { name: "" }).catch((x) => x);
    expect(e).toBeInstanceOf(FormValidationError);
  });

  it("deletes only the user's project", async () => {
    const s = make();
    await expect(s.delete("alice", 2)).rejects.toBeInstanceOf(NotFoundError);
    await s.delete("alice", 1);
    await expect(s.require("alice", 1, "read")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("SettingsService (API keys)", () => {
  const keys: ApiKey[] = [{ id: 1, projectId: 1, name: "k", prefix: "snl_aaaaaaaa", permissions: ["send"], createdAt: new Date() }, { id: 2, projectId: 2, name: "k", prefix: "snl_bbbbbbbb", permissions: ["send"], createdAt: new Date() }];
  const repo = {
    findByHash: async () => null,
    findLegacyByKey: async () => null,
    findByProject: async (pid: number) => keys.filter((k) => k.projectId === pid),
    findById: async (id: number) => keys.find((k) => k.id === id) ?? null,
    create: vi.fn(async (d: any) => ({ id: 3, ...d, createdAt: new Date() })),
    updateLastUsed: async () => {},
    delete: vi.fn(async () => {}),
  };
  const service = new SettingsService(repo, projectsRepo());

  it("scopes everything to the user's project", async () => {
    expect((await service.listApiKeys("alice", 1)).length).toBe(1);
    await expect(service.listApiKeys("alice", 2)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.createApiKey("alice", 1, "  ")).rejects.toBeInstanceOf(ValidationError);
    await expect(service.createApiKey("alice", 1, "x".repeat(256))).rejects.toBeInstanceOf(ValidationError);
    const k = await service.createApiKey("alice", 1, " prod ");
    expect(k.name).toBe("prod");
    expect(k.key).toMatch(/^snl_[a-z2-7]{32}$/);
    expect(k.prefix).toBe(k.key.slice(0, 12));
    // The repository never sees the key, only its hash and prefix.
    const stored = repo.create.mock.calls[0][0];
    expect(stored.key).toBeUndefined();
    expect(stored.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.prefix).toBe(k.prefix);
    await expect(service.deleteApiKey("alice", 2)).rejects.toBeInstanceOf(NotFoundError);
    expect(await service.deleteApiKey("alice", 1)).toEqual({ projectId: 1 });
  });

  it("gives a new key send only, unless it asks for more", async () => {
    repo.create.mockClear();
    expect((await service.createApiKey("alice", 1, "app")).permissions).toEqual(["send"]);
    expect(repo.create.mock.calls[0][0].permissions).toEqual(["send"]);

    expect((await service.createApiKey("alice", 1, "agent", ["manage"])).permissions).toEqual(["manage"]);
    // Deduplicated, in a fixed order.
    expect((await service.createApiKey("alice", 1, "both", ["manage", "send", "manage"])).permissions).toEqual([
      "send",
      "manage",
    ]);
  });

  it("refuses an empty or unknown permission list", async () => {
    repo.create.mockClear();
    await expect(service.createApiKey("alice", 1, "k", [])).rejects.toBeInstanceOf(ValidationError);
    await expect(service.createApiKey("alice", 1, "k", ["admin"])).rejects.toBeInstanceOf(ValidationError);
    await expect(service.createApiKey("alice", 1, "k", "send")).rejects.toBeInstanceOf(ValidationError);
    expect(repo.create).not.toHaveBeenCalled();
  });
});
