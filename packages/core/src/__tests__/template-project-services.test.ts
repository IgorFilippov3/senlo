import { describe, it, expect, vi } from "vitest";
import { TemplateService, mergeTagsFromVariables } from "../services/emailTemplateService";
import { SavedRowService } from "../services/savedRowService";
import { ProjectService } from "../services/projectService";
import { SettingsService } from "../services/settingsService";
import { EMPTY_EMAIL_DESIGN } from "../constants";
import { FormValidationError, NotFoundError, ValidationError } from "../errors";
import type { ApiKey, Campaign, EmailProvider, Project, SavedRow } from "../domain";
import type { EmailTemplate } from "../emailTemplate";

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
    update: async (id: number, d: Partial<Project>) => (rows.has(id) ? { ...rows.get(id)!, ...d } : null),
    delete: async (id: number) => { rows.delete(id); },
  };
};

const tpl = (id: number, projectId: number, over: Partial<EmailTemplate> = {}): EmailTemplate =>
  ({ id, projectId, name: `t${id}`, subject: `s${id}`, preheader: null, html: "", designJson: null, locale: "en", status: "DRAFT", createdAt: new Date(), updatedAt: new Date(), ...over }) as EmailTemplate;

function templateFakes() {
  const templates = new Map([tpl(10, 1), tpl(20, 2), tpl(11, 1, { designJson: { ...EMPTY_EMAIL_DESIGN, rows: [] } })].map((t) => [t.id, t]));
  const campaigns: Campaign[] = [
    { id: 100, projectId: 1, templateId: 10, variablesSchema: { first_name: "x", order_id: 1 } } as unknown as Campaign,
    { id: 200, projectId: 2, templateId: 20 } as unknown as Campaign,
  ];
  const providers: EmailProvider[] = [
    { id: 5, userId: "alice", type: "RESEND", name: "r", config: {}, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 6, userId: "bob", type: "RESEND", name: "r", config: {}, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ];
  const queue = {
    add: vi.fn(async () => ({ id: "job-1" }) as never),
    getWorkers: vi.fn(async () => [{}] as never),
  };
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
  };
  const service = new TemplateService(repos, queue, { appUrl: "https://app.test", defaultFromEmail: "hello@app.test" });
  return { service, repos, queue, templates };
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

  it("sendTest checks addresses, provider presence and ownership, then queues the rendered mail", async () => {
    const { service, queue } = templateFakes();
    const design = EMPTY_EMAIL_DESIGN;
    await expect(service.sendTest("alice", 10, { to: "a@b, c@d", design })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.sendTest("alice", 10, { to: "a@b.co", from: "Me <x@y.co>", design })).rejects.toBeInstanceOf(ValidationError);
    // Project 3 has no provider.
    const { service: s3 } = templateFakes();
    s3["repos"].templates.findById = async () => tpl(30, 3);
    await expect(s3.sendTest("alice", 30, { to: "a@b.co", design })).rejects.toThrow(/No email provider/);
    expect(queue.add).not.toHaveBeenCalled();

    const r = await service.sendTest("alice", 10, { to: "a@b.co", from: "", design, subject: "" });
    expect(r).toEqual({ jobId: "job-1", activeWorkers: 1 });
    const job = (queue.add.mock.calls[0] as any)[1];
    expect(job).toMatchObject({ projectId: 1, campaignId: 0, contactId: 0, email: "a@b.co", from: "hello@app.test", subject: "[TEST] s10", providerId: 5 });
    expect(job.html).toContain("<");
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

  it("deletes only the user's project", async () => {
    const s = make();
    await expect(s.delete("alice", 2)).rejects.toBeInstanceOf(NotFoundError);
    await s.delete("alice", 1);
    await expect(s.require("alice", 1)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("SettingsService (API keys)", () => {
  const keys: ApiKey[] = [{ id: 1, projectId: 1, name: "k", prefix: "snl_aaaaaaaa", createdAt: new Date() }, { id: 2, projectId: 2, name: "k", prefix: "snl_bbbbbbbb", createdAt: new Date() }];
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
});
