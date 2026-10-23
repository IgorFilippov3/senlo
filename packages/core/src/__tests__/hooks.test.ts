import { describe, it, expect, vi } from "vitest";
import { AccessGuard } from "../access";
import type { Campaign, Contact, EmailProvider, Project, Workflow } from "../domain";
import type { EmailTemplate } from "../emailTemplate";
import { QuotaExceededError } from "../errors";
import { ServiceHooks, type AuditEntry, type QuotaAction, type UsageEvent } from "../hooks";
import type { Logger } from "../logger";
import { EmailWorkerProcessor } from "../queue/worker";
import { AudienceService } from "../services/audienceService";
import { EmailProviderService } from "../services/emailProviderService";
import { ProjectService } from "../services/projectService";
import { TriggerService } from "../services/triggerService";
import { WorkflowService } from "../services/workflowService";

const at = new Date();
const silent: Logger = { debug() {}, info() {}, warn() {}, error: vi.fn() };

/** Fake ports that remember every call; `deny` makes the quota say no. */
function ports(deny?: string) {
  const usage: UsageEvent[] = [];
  const checks: QuotaAction[] = [];
  const audit: AuditEntry[] = [];
  const hooks = new ServiceHooks(
    {
      usage: { record: async (e) => void usage.push(e) },
      quota: {
        check: async (a) => {
          checks.push(a);
          return deny ? { allowed: false, reason: deny } : { allowed: true };
        },
      },
      audit: { record: async (e) => void audit.push(e) },
    },
    silent,
  );
  return { hooks, usage, checks, audit };
}

const project = { id: 1, userId: "alice", organizationId: null, name: "p", providerId: 7, createdAt: at, updatedAt: at } as Project;
const projects = {
  findById: async (id: number) => (id === 1 ? project : null),
  findAll: async () => [project],
  listForUser: async () => [project],
  listForOrganization: async () => [],
  create: vi.fn(async (d: Partial<Project>) => ({ ...project, ...d, id: 2 }) as Project),
  update: async () => project,
  delete: async () => {},
};

describe("ServiceHooks", () => {
  it("turns a quota refusal into QuotaExceededError with the policy's reason", async () => {
    await expect(ports("Plan limit: 100 emails").hooks.requireQuota({ type: "email.send", projectId: 1 }))
      .rejects.toThrow(new QuotaExceededError("Plan limit: 100 emails"));
  });

  it("logs and swallows a failing meter or audit sink", async () => {
    const logger = { ...silent, error: vi.fn() };
    const boom = async () => { throw new Error("sink down"); };
    const hooks = new ServiceHooks({ usage: { record: boom }, audit: { record: boom } }, logger);
    await hooks.recordUsage({ type: "contact.created", projectId: 1, contactId: 1 });
    await hooks.audit({ actor: { userId: "a" }, action: "x.y", target: { type: "project", id: 1 } });
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it("defaults to no limits and no records", async () => {
    await expect(ServiceHooks.none.requireQuota({ type: "email.send", projectId: 1 })).resolves.toBeUndefined();
  });
});

describe("services call the ports once per action", () => {
  it("project create: quota, usage and audit", async () => {
    const p = ports();
    const service = new ProjectService(
      { projects, providers: { findById: async () => null }, aiProviders: { findById: async () => null } },
      new AccessGuard(projects),
      p.hooks,
    );
    await service.create("alice", { name: "New" });
    expect(p.checks).toEqual([{ type: "project.create", scope: { userId: "alice", organizationId: null } }]);
    expect(p.usage).toEqual([{ type: "project.created", projectId: 2, scope: { userId: "alice", organizationId: null } }]);
    expect(p.audit.map((e) => e.action)).toEqual(["project.created"]);

    const refused = ports("No more projects");
    const blocked = new ProjectService(
      { projects, providers: { findById: async () => null }, aiProviders: { findById: async () => null } },
      new AccessGuard(projects),
      refused.hooks,
    );
    projects.create.mockClear();
    await expect(blocked.create("alice", { name: "Again" })).rejects.toThrow(QuotaExceededError);
    expect(projects.create).not.toHaveBeenCalled();
  });

  it("contact create: counted only when the address is new", async () => {
    const p = ports();
    const known = new Set(["old@x.test"]);
    const contacts = {
      findByEmail: async (_p: number, email: string) => (known.has(email) ? ({ id: 1 } as Contact) : null),
      upsert: async (d: { email: string }) => ({ id: known.has(d.email) ? 1 : 2, meta: {} }) as Contact,
    };
    const audience = new AudienceService(
      {} as never,
      contacts as never,
      {} as never,
      { triggerEvent: async () => {} } as never,
      projects,
      undefined,
      p.hooks,
    );
    await audience.createContact({ projectId: 1, email: "old@x.test" });
    await audience.createContact({ projectId: 1, email: "new@x.test" });
    expect(p.checks).toEqual([{ type: "contact.create", projectId: 1 }]);
    expect(p.usage).toEqual([{ type: "contact.created", projectId: 1, contactId: 2 }]);
  });

  it("triggered send: refused before a send log exists", async () => {
    const p = ports("Out of sends");
    const logs = { create: vi.fn() };
    const trigger = new TriggerService(
      { findById: async () => ({ id: 5, projectId: 1, type: "TRIGGERED", templateId: 9 }) as Campaign } as never,
      { findById: async () => ({ id: 9, projectId: 1, subject: "Hi" }) as EmailTemplate } as never,
      { findById: async () => ({ id: 7, type: "RESEND" }) as EmailProvider } as never,
      projects,
      logs as never,
      { add: vi.fn() } as never,
      { linkSigningSecret: "s".repeat(32), defaultFromEmail: "a@x.test", appUrl: "https://app.test" },
      p.hooks,
    );
    await expect(
      trigger.sendTriggeredEmail({ campaignId: 5, projectId: 1, to: "r@x.test" }),
    ).rejects.toThrow(QuotaExceededError);
    expect(p.checks).toEqual([{ type: "email.send", projectId: 1 }]);
    expect(logs.create).not.toHaveBeenCalled();
  });

  it("send worker: a refused send is marked failed and not retried", async () => {
    const p = ports("Out of sends");
    const logRepo = { update: vi.fn(), findById: vi.fn() };
    const providerRepo = { findById: vi.fn() };
    const worker = new EmailWorkerProcessor(
      { appUrl: "https://app.test" } as never,
      { logEvent: vi.fn() } as never,
      providerRepo as never,
      {} as never,
      logRepo as never,
      undefined,
      silent,
      p.hooks,
    );
    await worker.processEmailJob({
      id: "j1",
      data: { projectId: 1, campaignId: 0, contactId: null, logId: 3, email: "r@x.test", from: "a@x.test", subject: "s", providerId: 7 },
    } as never);
    expect(logRepo.update).toHaveBeenCalledWith(3, { status: "FAILED", error: "Out of sends" });
    expect(providerRepo.findById).not.toHaveBeenCalled();
    expect(p.usage).toEqual([]);
  });

  it("audits provider and workflow changes", async () => {
    const p = ports();
    const stored = new Map<number, EmailProvider>();
    const providers = new EmailProviderService(
      {
        findById: async (id: number) => stored.get(id) ?? null,
        findAll: async () => [],
        listForUser: async () => [],
        listForOrganization: async () => [],
        create: async (d: Omit<EmailProvider, "id" | "createdAt" | "updatedAt">) => {
          const row = { ...d, id: 4, createdAt: at, updatedAt: at };
          stored.set(4, row);
          return row;
        },
        update: async (id: number, d: Partial<EmailProvider>) => ({ ...stored.get(id)!, ...d }),
        delete: async (id: number) => void stored.delete(id),
      },
      AccessGuard.forOwnedRecords(),
      p.hooks,
    );
    await providers.create("alice", { name: "R", type: "RESEND", apiKey: "secret" });
    await providers.setActive("alice", 4, false);
    await providers.delete("alice", 4);

    const workflow = { id: 10, projectId: 1, name: "w", status: "DRAFT", createdAt: at, updatedAt: at } as Workflow;
    const workflows = new WorkflowService(
      {
        workflows: { findById: async () => workflow, update: async () => workflow, getNodes: async () => [], getEdges: async () => [] } as never,
        projects,
        campaigns: {} as never,
      },
      undefined,
      p.hooks,
    );
    await workflows.setStatus("alice", 10, "PAUSED");

    expect(p.audit.map((e) => e.action)).toEqual([
      "email_provider.created",
      "email_provider.deactivated",
      "email_provider.deleted",
      "workflow.status_changed",
    ]);
    expect(p.audit[3]).toMatchObject({ target: { type: "workflow", id: 10, projectId: 1 }, details: { from: "DRAFT", to: "PAUSED" } });
    expect(JSON.stringify(p.audit)).not.toContain("secret");
  });
});
